// ── Prompt Builders ───────────────────────────────────────────────────────────
// All prompt construction lives here. Nodes call these functions and pass the
// result to the model — no prompt strings scattered across node implementations.
//
// Keeping prompts isolated means:
//   - Prompt iteration doesn't touch node logic
//   - Tests can assert on prompt content without invoking the model
//   - The model abstraction layer (provider.ts) sits cleanly underneath

import type { QuestionHistoryEntry, InterviewerMode, GraphTurnInput } from "./ai.graph.types.js";
import { coveredTopics, summarizeCategoryMix, type CategoryMix } from "./coverage.js";
import type { QuestionCategory } from "./coverage.js";

// Minimal state shape prompts.ts needs — no LangGraph dependency
export interface PromptStateContext {
  jobRole: string | null;
  domain: string | undefined;
  targetedCompany: string | undefined;
  jobSkills: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  interviewStyle: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM" | "REGULAR";
  currentInput: GraphTurnInput | null;
}

// ── Interviewer prompts ───────────────────────────────────────────────────────

export interface InterviewerPromptResult {
  systemPrompt: string;
  userPrompt: string;
  avoidTitles: string[]; // question titles already asked — for repetition check
}

/** Max topic tags listed in the prompt — keeps the instruction bounded. */
const MAX_LISTED_TOPICS = 10;

/**
 * Max question titles rendered into the avoid-list. The list is built from the full
 * session history (see buildInterviewerPrompt), so this only ever bites in a session
 * far longer than the configured duration allows — and when it does, the prompt says
 * so rather than dropping titles silently.
 */
const MAX_AVOID_TITLES = 40;

function categoryLabel(category: QuestionCategory): string {
  return category === "BEHAVIORAL" ? "behavioral/situational" : "technical/domain";
}

/**
 * Concrete per-session category instruction for MIXED interviews. This replaces
 * a single vague "alternate question types" line with the real counts plus an
 * explicit requirement, so the split stays inside the 40–60% band instead of
 * depending on the model's judgement.
 */
function mixingLines(mix: CategoryMix): string[] {
  if (mix.total === 0) {
    return [
      `Question-type balance: no questions asked yet.`,
      `  - Opening question: either a behavioral or a technical question is acceptable.`,
    ];
  }

  const lines = [
    `Question-type balance: this session has asked ${mix.behavioralCount} behavioral and ${mix.technicalCount} technical question(s) — keep coverage roughly even (40–60% of each type).`,
  ];

  if (mix.requiredCategory) {
    lines.push(
      `  - The next question MUST be a ${categoryLabel(mix.requiredCategory)} question; ${
        mix.requiredCategory === "BEHAVIORAL" ? "behavioral" : "technical"
      } questions are under-represented${
        mix.balanced ? " and the other type must not run ahead" : ""
      }.`,
    );
  }

  lines.push(
    `  - "questionType" must be the type of THIS question ("BEHAVIORAL" or "TECHNICAL"), never "MIXED".`,
  );

  return lines;
}

/**
 * Topic-diversity instruction built from the subdomain tags already covered.
 * Titles alone are not enough: three differently-titled questions can all sit on
 * the same theme.
 */
function topicLines(history: QuestionHistoryEntry[]): string[] {
  const tags = coveredTopics(history);
  if (tags.length === 0) {
    return [
      `Subdomain coverage: no subdomain has been covered yet — pick a distinct theme for this question.`,
    ];
  }

  const listed = tags.slice(-MAX_LISTED_TOPICS);
  return [
    `Subdomains already covered in this session (do NOT generate another question on these themes):`,
    ...listed.map((tag) => `  - "${tag}"`),
    `Only revisit one of these themes if the question is a deliberate follow-up to the current line of questioning.`,
  ];
}

/**
 * Wrap-up bias for the final stretch of a session (soft duration threshold).
 * The adaptive engine sets hint.wrapUp once the configured duration is ~90% used.
 */
function wrapUpLines(hint: { wrapUp?: boolean } | null): string[] {
  if (!hint?.wrapUp) return [];
  return [
    `Wrap-up window: the configured interview duration is almost over.`,
    `  - Ask a closing question on the CURRENT line of discussion instead of opening a new one.`,
    `  - Keep it answerable in a single turn and do not escalate difficulty.`,
  ];
}

export function buildInterviewerPrompt(
  state: PromptStateContext,
  mode: InterviewerMode,
  trimmedHistory: QuestionHistoryEntry[],
  hint: { mode: string; difficulty: string; topicHint?: string; wrapUp?: boolean } | null = null,
  // Complete session history — the category split and topic tags are computed
  // from this, so context-window trimming can never skew the counts.
  fullHistory: QuestionHistoryEntry[] = trimmedHistory,
): InterviewerPromptResult {
  const role = state.jobRole ?? "a software engineer";
  const companyContext = state.targetedCompany ? ` Target company: ${state.targetedCompany}.` : "";
  const domainContext = state.domain ? ` Domain: ${state.domain}.` : "";
  const skills =
    state.jobSkills.length > 0 ? state.jobSkills.join(", ") : "general software engineering";
  // Hint difficulty overrides state difficulty when the adaptive engine has decided
  const difficulty = (hint?.difficulty ?? state.difficulty).toLowerCase();
  const type = state.interviewType;
  const style = state.interviewStyle;
  // Built from the COMPLETE session history, not the context-trimmed slice. Trimming
  // exists to fit the narrative history in the context window; it must never silently
  // remove a question from the explicit do-not-repeat list, which is what used to
  // happen for a very long session (the topic list below already had to make this
  // same correction). The repetition guard in graph.ts is the mechanical backstop;
  // this list is the instruction that keeps the model from needing it.
  const avoidTitles = fullHistory.map((h) => h.questionTitle);
  const mix = summarizeCategoryMix(fullHistory);
  // For MIXED sessions the model types each question itself.
  const questionTypeSchema = type === "MIXED" ? `"BEHAVIORAL" | "TECHNICAL"` : `"${type}"`;

  const omittedTitles = Math.max(0, avoidTitles.length - MAX_AVOID_TITLES);
  const avoidSection =
    avoidTitles.length > 0
      ? `\n\nDo NOT repeat any of these already-asked questions:\n${avoidTitles
          .slice(0, MAX_AVOID_TITLES)
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}${
          omittedTitles > 0
            ? `\n(${omittedTitles} earlier question(s) omitted from this list for length — every question already asked in this session is off-limits, not just the ones shown.)`
            : ""
        }`
      : "";

  const historySection =
    trimmedHistory.length > 0
      ? `\n\nInterview history so far:\n${trimmedHistory
          .map(
            (h) =>
              `Q${h.sequenceNumber}: "${h.questionTitle}" — ${h.wasAnswered ? `answered (score: ${h.score ?? "pending"})` : "skipped/timed out"}`,
          )
          .join("\n")}`
      : "";

  const topicHintSection = hint?.topicHint ? `\nFocus on the topic: ${hint.topicHint}.` : "";

  const systemPrompt = [
    `You are an AI interviewer conducting a ${style}-style ${type} interview.`,
    `Your sole responsibility in this turn is to generate the next interview question.`,
    `The candidate is applying for the role of ${role}.${domainContext}${companyContext} Relevant skills: ${skills}. Difficulty: ${difficulty}.`,
    `Interaction rules:`,
    `  - Generate exactly ONE question that is appropriate for the current difficulty and interview type.`,
    `  - Never repeat a question that has already been asked in this session.`,
    `  - Maintain natural interview flow: do not jump topics abruptly unless instructed to change topic.`,
    `  - Do not evaluate, score, or comment on previous answers — that is handled separately.`,
    `  - Do not ask multiple questions in a single turn.`,
    `  - Vary the subdomain of each question: never ask two questions on the same theme with different wording.`,
    ...(type === "MIXED" ? mixingLines(mix) : []),
    ...topicLines(fullHistory),
    ...wrapUpLines(hint),
    `Respond with a JSON object only — no markdown, no explanation.`,
    `Schema: { "questionTitle": string, "questionDescription": string | null, "questionType": ${questionTypeSchema}, "topic": string }`,
    `questionDescription should be a brief clarifying note (1–2 sentences) or null if the question is self-explanatory.`,
    `"topic" is a short kebab-case subdomain tag for this question (2-4 words, e.g. "feature-store", "url-shortener", "team-conflict"). Use a NEW tag unless this question is a deliberate follow-up on the same subdomain.`,
  ].join("\n");

  let userPrompt: string;

  if (mode === "initial") {
    userPrompt = `Generate the opening question for this interview. It should be appropriate for a ${difficulty} ${type} interview.${topicHintSection}${avoidSection}`;
  } else if (mode === "follow_up") {
    const last = trimmedHistory[trimmedHistory.length - 1];
    const lastTitle = last?.questionTitle ?? "the previous question";
    const lastScore = last?.score;
    const performanceHint =
      lastScore !== null && lastScore !== undefined
        ? lastScore >= 70
          ? "The candidate answered well — probe deeper or increase complexity."
          : lastScore >= 40
            ? "The candidate gave a partial answer — ask a follow-up to clarify or expand."
            : "The candidate struggled — ask a simpler follow-up or a related foundational question."
        : "Generate a natural follow-up to the previous question.";
    userPrompt = `Previous question: "${lastTitle}"\n${performanceHint}${topicHintSection}${avoidSection}`;
  } else {
    // topic_change
    userPrompt = `The current topic has been sufficiently covered. Generate a question on a DIFFERENT topic within ${type} interviewing for a ${role}.${topicHintSection}${historySection}${avoidSection}`;
  }

  return { systemPrompt, userPrompt, avoidTitles };
}

// ── Coverage instructions for MIXED sessions ──────────────────────────────────
// Owned by coverage.ts (pure + unit-tested); re-exported here so prompt tests
// can exercise the mixing rules without invoking a model.
export {
  coveredTopics,
  summarizeCategoryMix,
  CATEGORY_SHARE_MAX,
  type CategoryMix,
  type QuestionCategory,
} from "./coverage.js";

// ── Evaluator prompts ─────────────────────────────────────────────────────────

export interface EvaluatorPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildEvaluatorPrompt(
  state: PromptStateContext,
  trimmedHistory: QuestionHistoryEntry[],
): EvaluatorPromptResult {
  const questionTitle = state.currentInput?.questionTitle ?? "the interview question";
  const answerData = state.currentInput?.answerData ?? "";
  const answerType = state.currentInput?.answerType ?? "TEXT";
  const role = state.jobRole ?? "a software engineer";
  const difficulty = state.difficulty.toLowerCase();

  const historyContext =
    trimmedHistory.length > 0
      ? `\n\nPrevious questions for context:\n${trimmedHistory
          .slice(-3)
          .map((h) => `- "${h.questionTitle}" (score: ${h.score ?? "pending"})`)
          .join("\n")}`
      : "";

  const systemPrompt = [
    `You are an AI evaluator assessing a candidate's answer during a ${difficulty}-difficulty interview for the role of ${role}.`,
    `Your sole responsibility is to evaluate the answer provided — not to ask questions or continue the interview.`,
    `Evaluation rules:`,
    `  - Score strictly and fairly based on technical accuracy, relevance, clarity, and depth.`,
    `  - Your scores and detection signals are consumed by an adaptive engine to adjust interview difficulty and topic.`,
    `  - Your feedback is shown to the candidate after the session — make it constructive and specific.`,
    `  - Do not generate follow-up questions or suggest what the candidate should have said.`,
    `Respond with a JSON object only — no markdown, no explanation.`,

    `Schema:`,
    `{`,
    `  "score": number (0-100, overall),`,
    `  "correctness": number (0-100, factual/technical accuracy),`,
    `  "relevance": number (0-100, how directly it addresses the question),`,
    `  "clarity": number (0-100, how clearly communicated),`,
    `  "technicalDepth": number (0-100, depth of technical understanding shown),`,
    `  "feedback": string (2-3 sentences of constructive feedback),`,
    `  "strengths": string[] (up to 3 specific strengths, empty array if none),`,
    `  "weaknesses": string[] (up to 3 specific weaknesses, empty array if none),`,
    `  "detectionSignals": string[] (subset of: "strong", "weak", "vague", "incomplete", "off_topic", "none")`,
    `}`,
    `Detection signal rules:`,
    `  "strong"     — score >= 80 and answer directly addresses the question`,
    `  "weak"       — score < 40`,
    `  "vague"      — answer is on-topic but lacks specificity or depth`,
    `  "incomplete" — answer stops short of fully addressing the question, or is empty`,
    `  "off_topic"  — answer does not address the question at all`,
    `  "none"       — none of the above apply (average answer)`,
    `Multiple signals are allowed (e.g. ["vague", "incomplete"]). Use "none" only when no other signal applies.`,
  ].join("\n");

  const userPrompt = [
    `Question: "${questionTitle}"`,
    `Answer type: ${answerType}`,
    `Candidate's answer: "${answerData}"`,
    historyContext,
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}
