// ── Prompt Builders ───────────────────────────────────────────────────────────
// All prompt construction lives here. Nodes call these functions and pass the
// result to the model — no prompt strings scattered across node implementations.
//
// Keeping prompts isolated means:
//   - Prompt iteration doesn't touch node logic
//   - Tests can assert on prompt content without invoking the model
//   - The model abstraction layer (provider.ts) sits cleanly underneath

import type { QuestionHistoryEntry, InterviewerMode, GraphTurnInput } from "./ai.graph.types.js";

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

export function buildInterviewerPrompt(
  state: PromptStateContext,
  mode: InterviewerMode,
  trimmedHistory: QuestionHistoryEntry[],
  hint: { mode: string; difficulty: string; topicHint?: string } | null = null,
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
  const avoidTitles = trimmedHistory.map((h) => h.questionTitle);

  const avoidSection =
    avoidTitles.length > 0
      ? `\n\nDo NOT repeat any of these already-asked questions:\n${avoidTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
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
    ...(type === "MIXED" ? ["  - Alternate question types across the session: behavioral/situational questions and technical/domain questions must both be included. Do not make every question technical."] : []),
    `Respond with a JSON object only — no markdown, no explanation.`,
    `Schema: { "questionTitle": string, "questionDescription": string | null, "questionType": "${type}" }`,
    `questionDescription should be a brief clarifying note (1–2 sentences) or null if the question is self-explanatory.`,
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
