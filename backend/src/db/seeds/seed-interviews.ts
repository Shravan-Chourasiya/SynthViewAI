/**
 * Seed 10 interviews that, between them, cover the widest practical spread of
 * interview configurations — type × company style × difficulty × ending
 * criteria × adaptivity × follow-up limit — plus a deliberate spread of
 * statuses and scores so the dashboard, analytics and admin pages all have
 * something real to render.
 *
 * Every COMPLETED interview also gets its questions, answers, per-answer
 * evaluations and a rolled-up result row. Analytics reads `interview_results`
 * joined to `interviews` and returns an empty payload when that table is empty,
 * so the result rows are what actually make the charts move.
 *
 * Usage (from ./backend):
 *   npm run db:seed:interviews
 *   npm run db:seed:interviews -- --status-extras   # also fill the remaining lifecycle statuses
 *   npm run db:seed:interviews -- --user you@example.com
 *
 * Idempotent: rows created by a previous run are deleted first (matched by the
 * "[SEED]" title prefix), which cascades to their questions, answers,
 * evaluations and results.
 */
import bcrypt from "bcrypt";
import { asc, count, eq, like } from "drizzle-orm";
import { getPgDb, getPgPool } from "../postgres.init.js";
import { usersTable } from "../../modules/auth/schemas/user.schema.js";
import { SALT_ROUNDS } from "../../constants/auth.constants.js";
import { interviewsTable } from "../../modules/interview/schemas/interview.schema.js";
import { interviewQuestionsTable } from "../../modules/interview/schemas/question.schema.js";
import { interviewAnswersTable } from "../../modules/interview/schemas/answers.schema.js";
import { answerEvaluationTable } from "../../modules/interview/schemas/evaluation.schema.js";
import { interviewResultsTable } from "../../modules/interview/schemas/result.schema.js";

/**
 * Config unions read straight off the table's select type, so a new value in the
 * drizzle enum fails this script at typecheck instead of silently inserting an
 * unsupported string. The select type is used (not the insert type) because the
 * insert type widens defaulted columns to `| undefined`.
 */
type InterviewRow = typeof interviewsTable.$inferSelect;
type InterviewType = InterviewRow["interviewType"];
type CompanyStyle = InterviewRow["interviewCompanyStyle"];
type Difficulty = InterviewRow["interviewDifficulty"];
type InterviewStatus = InterviewRow["interviewStatus"];
type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

const SEED_PREFIX = "[SEED] ";
const SEED_PASSWORD = "SeedPass123!";

interface PlanScores {
  overall: number;
  technical: number;
  communication: number;
  problemSolving: number;
  confidence: number;
}

interface InterviewPlan {
  title: string;
  description: string;
  type: InterviewType;
  companyStyle: CompanyStyle;
  difficulty: Difficulty;
  durationMinutes: number;
  /** Deterministic creation offset so trend charts span ~3 months. */
  createdDaysAgo: number;
  createdHour: number;
  scheduledInDays?: number;
  meta: {
    jobRole?: string;
    domain?: string;
    experience?: string;
    jobSkills?: string[];
    targetedCompany?: string;
    targetedCompanyOther?: string;
    endingCriteria: "QUESTION_COUNT" | "DURATION";
    questionCount?: number;
    maxFollowUps: number;
    isAdaptive: boolean;
  };
  status: InterviewStatus;
  /** Question lifecycle counts — must add up to `questions`. */
  questions: number;
  answered: number;
  timedOut: number;
  skipped: number;
  pending: number;
  scores?: PlanScores;
  verdict?: Verdict;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  improvements?: string;
  resources?: string;
  /** Distributed mode: pin this plan to a specific user email. */
  userEmail?: string;
}

/** Deterministic PRNG (mulberry32) so re-runs produce identical data. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value * 100) / 100));

const money = (value: number): string => clampScore(value).toFixed(2);

const BEHAVIORAL_POOL: { title: string; description: string }[] = [
  {
    title: "Tell me about a time you disagreed with a teammate",
    description:
      "Walk me through the situation, how you handled the disagreement, and what the outcome was for the team.",
  },
  {
    title: "Describe the project you are most proud of",
    description:
      "What was your specific contribution, what made it hard, and how did you measure success?",
  },
  {
    title: "How do you handle competing deadlines?",
    description:
      "Give a concrete example where two stakeholders both needed something urgent from you.",
  },
  {
    title: "Tell me about a time you failed",
    description: "What happened, what did you own, and what changed in how you work afterwards?",
  },
  {
    title: "Describe a moment you took ownership beyond your role",
    description:
      "What gap did you notice, why did you step in, and how did you bring others with you?",
  },
  {
    title: "How do you give difficult feedback to a peer?",
    description: "Describe the preparation, the conversation itself, and how the relationship held up.",
  },
  {
    title: "Tell me about a time you had to learn something quickly",
    description: "What was the deadline, how did you structure your learning, and did it land?",
  },
  {
    title: "How do you prioritise when everything feels urgent?",
    description: "What framework or signals do you actually use, and where has it failed you?",
  },
  {
    title: "Tell me about a time you influenced a decision without authority",
    description: "Who was the decision maker, how did you build the case, and what was the result?",
  },
  {
    title: "How do you handle ambiguous requirements?",
    description: "Walk me through how you turn a vague ask into something you can build and ship.",
  },
];

const TECHNICAL_POOL: { title: string; description: string }[] = [
  {
    title: "Design a URL shortener",
    description:
      "Cover the data model, ID generation, read/write ratio, caching and how you would scale past a billion links.",
  },
  {
    title: "What happens when you type a URL into a browser?",
    description: "Go end to end: DNS, TLS, HTTP, rendering. Stop wherever you feel least certain and explain why.",
  },
  {
    title: "SQL or NoSQL for a booking system?",
    description: "Compare the trade-offs for inventory, double-booking prevention and reporting.",
  },
  {
    title: "How would you find a memory leak in a Node.js service?",
    description: "Describe the signals you would watch, the tooling you would use and how you would confirm the fix.",
  },
  {
    title: "Explain database indexing and when an index hurts",
    description: "What does the planner do, and what are the write-amplification and cardinality pitfalls?",
  },
  {
    title: "How do you make an API idempotent?",
    description: "Show the mechanism for a payments endpoint and how retries behave under concurrency.",
  },
  {
    title: "How would you cache an expensive query safely?",
    description: "Cover invalidation, stampedes, key design and what happens on a cold cache.",
  },
  {
    title: "Optimistic vs pessimistic locking",
    description: "When do you reach for each? Give a concrete conflict scenario from your experience.",
  },
  {
    title: "Design rate limiting for a public API",
    description: "Which algorithm, where does the state live, and how do you behave when Redis is unavailable?",
  },
  {
    title: "Microservices vs a modular monolith",
    description: "What would actually make you split a service, and what does the split cost you?",
  },
];

const MIXED_POOL: { title: string; description: string }[] = [
  {
    title: "Explain a technical decision to non-engineers",
    description: "Pick a real decision and walk me through how you framed it for a product audience.",
  },
  {
    title: "How would you prioritise a bug affecting 1% of users?",
    description: "What data would you pull, who would you involve, and what would you decide?",
  },
  {
    title: "Tell me about pushing back on a technical requirement",
    description: "What was asked, why was it risky, and how did you propose an alternative?",
  },
  {
    title: "Describe a production incident you handled",
    description: "Take me through detection, mitigation, communication and the follow-up actions.",
  },
  {
    title: "How do you balance shipping fast with code quality?",
    description: "Where do you draw the line, and how do you make that call visible to the team?",
  },
  {
    title: "Explain a system you built to a newcomer",
    description: "Start at the boundaries and work inwards. What would you deliberately leave out?",
  },
  {
    title: "How do you onboard onto an unfamiliar codebase?",
    description: "What is your first week, and how do you avoid breaking things you do not understand?",
  },
  {
    title: "Tell me about disagreeing with an architectural decision",
    description: "How did you raise it, and how did you behave once the decision went the other way?",
  },
  {
    title: "How would you scope an MVP for a vague product ask?",
    description: "What do you cut first, and how do you validate the cut was right?",
  },
  {
    title: "Describe how you would mentor a junior engineer",
    description: "What does your week-by-week approach look like, and how do you measure progress?",
  },
];

const POOLS: Record<InterviewType, { title: string; description: string }[]> = {
  BEHAVIORAL: BEHAVIORAL_POOL,
  TECHNICAL: TECHNICAL_POOL,
  MIXED: MIXED_POOL,
};

const WEAK_FEEDBACK = [
  "The answer stayed at a high level. Naming the constraint you were optimising for would have made this land.",
  "There was a plausible approach here, but the trade-offs were asserted rather than reasoned through.",
  "Good instinct on the structure; the details thinned out exactly where the problem got interesting.",
];

const MID_FEEDBACK = [
  "Solid coverage of the main path with some real detail. A concrete example would have moved this up a level.",
  "You sized the problem sensibly. The failure modes were mentioned but not explored.",
  "Clear reasoning overall; the answer would be stronger with numbers or a real measurement.",
];

const STRONG_FEEDBACK = [
  "Strong answer — you separated the requirements from the implementation and justified the trade-offs explicitly.",
  "Excellent depth. You anticipated the follow-up and addressed the edge case before being asked.",
  "Very clear. The structure made it easy to follow and the technical detail backed up the claims.",
];

function pickFeedback(rng: () => number, score: number): string {
  const pool = score >= 75 ? STRONG_FEEDBACK : score >= 55 ? MID_FEEDBACK : WEAK_FEEDBACK;
  const index = Math.floor(rng() * pool.length);
  return pool[Math.min(index, pool.length - 1)]!;
}

/**
 * The 10 requested interviews. Between them they cover:
 *   types            BEHAVIORAL / TECHNICAL / MIXED
 *   company styles   MANGOS / FAANG / MAANG / STARTUP / CUSTOM / REGULAR
 *   difficulties     EASY / MEDIUM / HARD
 *   ending criteria  QUESTION_COUNT / DURATION
 *   adaptivity       isAdaptive true and false, maxFollowUps 0–3
 *   statuses         COMPLETED / SCHEDULED / INPROGRESS / ABANDONED / DRAFT
 *   scores           47.50 → 91.00 with a dip-then-recovery shape for charts
 */
const PLANS: InterviewPlan[] = [
  {
    title: "System Design Deep Dive — FAANG Interviewer",
    description:
      "Ten-question adaptive technical loop with a FAANG-calibrated bar. Heavy on distributed systems and trade-off reasoning.",
    type: "TECHNICAL",
    companyStyle: "FAANG",
    difficulty: "HARD",
    durationMinutes: 60,
    createdDaysAgo: 88,
    createdHour: 10,
    meta: {
      jobRole: "Senior Backend Engineer",
      domain: "Backend Engineering",
      experience: "5-8 years",
      jobSkills: ["Node.js", "PostgreSQL", "Distributed Systems", "Caching"],
      targetedCompany: "Google",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 10,
      maxFollowUps: 3,
      isAdaptive: true,
    },
    status: "COMPLETED",
    questions: 10,
    answered: 9,
    timedOut: 0,
    skipped: 1,
    pending: 0,
    scores: { overall: 84.5, technical: 88, communication: 79.5, problemSolving: 86, confidence: 82 },
    verdict: "PASS",
    strengths: ["System design", "Trade-off reasoning", "Technical depth", "Caching strategy"],
    weaknesses: ["Time management", "Conciseness"],
    summary:
      "A strong senior-level performance. You framed each problem in terms of requirements before jumping to components, and the caching discussion showed real production judgement. The one skipped question was a scheduling casualty rather than a knowledge gap.",
    improvements:
      "Practise budgeting the last two minutes of each answer for a summary — two answers drifted past the point where the interviewer had what they needed.",
    resources: "Review capacity estimation drills and the 'back-of-the-envelope' chapter in System Design Interview Vol. 2.",
  },
  {
    title: "Behavioural Round — MANGOS Fit",
    description:
      "Short behavioural screen calibrated to MANGOS leadership principles. Library-based questions, no follow-up pressure.",
    type: "BEHAVIORAL",
    companyStyle: "MANGOS",
    difficulty: "EASY",
    durationMinutes: 30,
    createdDaysAgo: 74,
    createdHour: 14,
    meta: {
      jobRole: "Software Engineer II",
      domain: "General Engineering",
      experience: "2-4 years",
      jobSkills: ["Collaboration", "Ownership", "Communication"],
      targetedCompany: "Microsoft",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 6,
      maxFollowUps: 0,
      isAdaptive: false,
    },
    status: "COMPLETED",
    questions: 6,
    answered: 5,
    timedOut: 0,
    skipped: 1,
    pending: 0,
    scores: { overall: 76.25, technical: 71, communication: 84.5, problemSolving: 74, confidence: 79.5 },
    verdict: "PASS",
    strengths: ["Behavioural storytelling", "Communication", "Collaboration", "Ownership"],
    weaknesses: ["Depth of technical detail"],
    summary:
      "Warm, well-structured STAR answers with clear personal contribution. Communication is a genuine strength here. The one gap is that technical context was often implied rather than explained, which makes the impact harder to size.",
    improvements: "Quantify outcomes in your stories — headcount, latency, revenue, ticket volume.",
    resources: "Write six STAR stories in advance, each with one metric attached.",
  },
  {
    title: "Mixed Screen — Startup Generalist",
    description:
      "Duration-bounded mixed round for an early-stage team. Adapts follow-ups based on the depth of the previous answer.",
    type: "MIXED",
    companyStyle: "STARTUP",
    difficulty: "MEDIUM",
    durationMinutes: 45,
    createdDaysAgo: 60,
    createdHour: 18,
    meta: {
      jobRole: "Full-stack Engineer",
      domain: "Product Engineering",
      experience: "3-5 years",
      jobSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      targetedCompany: "Razorpay",
      endingCriteria: "DURATION",
      questionCount: 7,
      maxFollowUps: 2,
      isAdaptive: true,
    },
    status: "COMPLETED",
    questions: 7,
    answered: 6,
    timedOut: 0,
    skipped: 1,
    pending: 0,
    scores: { overall: 61, technical: 63.5, communication: 68, problemSolving: 58.5, confidence: 55 },
    verdict: "INCONCLUSIVE",
    strengths: ["Communication", "Product sense"],
    weaknesses: ["Problem solving", "Edge-case handling", "Confidence under pressure"],
    summary:
      "Product instincts were good and you asked sensible clarifying questions, but the problem-solving track wobbled whenever the follow-up probed failure modes. The final answer was cut off by the clock, which cost you a chance to recover.",
    improvements:
      "Narrate your reasoning as you go instead of reaching for a finished answer — this round rewards visible thinking.",
    resources: "Practise five 'what breaks first?' drills on systems you already know.",
  },
  {
    title: "Algorithms & Complexity — MAANG Loop",
    description:
      "Time-boxed technical round focused on complexity analysis and correctness under constraints. Tight follow-up budget.",
    type: "TECHNICAL",
    companyStyle: "MAANG",
    difficulty: "MEDIUM",
    durationMinutes: 30,
    createdDaysAgo: 47,
    createdHour: 9,
    meta: {
      jobRole: "Software Engineer",
      domain: "Algorithms & Data Structures",
      experience: "1-3 years",
      jobSkills: ["Algorithms", "Data Structures", "Complexity Analysis"],
      targetedCompany: "Meta",
      endingCriteria: "DURATION",
      questionCount: 6,
      maxFollowUps: 1,
      isAdaptive: false,
    },
    status: "COMPLETED",
    questions: 6,
    answered: 4,
    timedOut: 1,
    skipped: 1,
    pending: 0,
    scores: { overall: 47.5, technical: 52, communication: 61, problemSolving: 44.5, confidence: 39 },
    verdict: "FAIL",
    strengths: ["Clarity of explanation"],
    weaknesses: ["Data structures", "Problem solving", "Time management", "Confidence under pressure"],
    summary:
      "This round ran out of road. Two questions were never reached, one timed out mid-answer, and the complexity analysis on the fourth question was the wrong order of growth. The explanations were clear, though — the gap is recall and speed, not communication.",
    improvements:
      "Rebuild fluency on arrays, heaps and hash maps with timed drills: three problems in thirty minutes, spoken out loud.",
    resources: "NeetCode 150 (arrays + heaps first), then two timed mocks per week.",
  },
  {
    title: "Leadership & Ownership Round",
    description:
      "Hard behavioural round for a people-leadership track, with adaptive probing on conflict and delivery risk.",
    type: "BEHAVIORAL",
    companyStyle: "REGULAR",
    difficulty: "HARD",
    durationMinutes: 45,
    createdDaysAgo: 33,
    createdHour: 11,
    meta: {
      jobRole: "Engineering Manager",
      domain: "Leadership",
      experience: "8+ years",
      jobSkills: ["People Management", "Delivery", "Stakeholder Management"],
      endingCriteria: "QUESTION_COUNT",
      questionCount: 6,
      maxFollowUps: 2,
      isAdaptive: true,
    },
    status: "COMPLETED",
    questions: 6,
    answered: 6,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    scores: { overall: 68.75, technical: 62.5, communication: 74, problemSolving: 66, confidence: 71.5 },
    verdict: "PASS",
    strengths: ["Stakeholder management", "Communication", "Ownership"],
    weaknesses: ["Depth of technical detail", "Concrete metrics"],
    summary:
      "Answers were honest and specific about people situations, which is exactly what this round screens for. Where it slipped was staying abstract about the technical constraints your decisions ran into.",
    improvements: "Pair each leadership story with the technical constraint that forced the hard call.",
    resources: "The Manager's Path, chapters 4-6, plus one written reflection per story.",
  },
  {
    title: "Bespoke Culture Interview — Fintech",
    description:
      "Bespoke short-format interview for a custom culture bar. Four questions, no follow-ups, speed-weighted.",
    type: "MIXED",
    companyStyle: "CUSTOM",
    difficulty: "EASY",
    durationMinutes: 20,
    createdDaysAgo: 21,
    createdHour: 16,
    meta: {
      jobRole: "Product Engineer",
      domain: "Fintech",
      experience: "3-6 years",
      jobSkills: ["API Design", "Payments", "Compliance"],
      targetedCompanyOther: "Stripe",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 4,
      maxFollowUps: 0,
      isAdaptive: false,
    },
    status: "COMPLETED",
    questions: 4,
    answered: 4,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    scores: { overall: 91, technical: 89.5, communication: 93, problemSolving: 90.5, confidence: 90 },
    verdict: "PASS",
    strengths: ["Communication", "Domain knowledge", "Trade-off reasoning", "Conciseness"],
    weaknesses: ["Edge-case handling"],
    summary:
      "The strongest round in this set. Domain vocabulary was accurate, answers were tight, and the idempotency discussion showed you have actually operated a payments surface. Only the failure-path answer left room.",
    improvements: "Add one sentence about the rollback path to your idempotency and retry stories.",
    resources: "Stripe API idempotency docs, and write up one reconciliation incident from memory.",
  },
  {
    title: "Frontend Architecture — Startup Panel",
    description:
      "Upcoming adaptive frontend architecture interview with a small startup panel. Scheduled but not yet started.",
    type: "TECHNICAL",
    companyStyle: "STARTUP",
    difficulty: "EASY",
    durationMinutes: 30,
    createdDaysAgo: 2,
    createdHour: 13,
    scheduledInDays: 4,
    meta: {
      jobRole: "Frontend Engineer",
      domain: "Frontend Engineering",
      experience: "2-5 years",
      jobSkills: ["React", "TypeScript", "Performance", "Accessibility"],
      targetedCompany: "Vercel",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
      maxFollowUps: 1,
      isAdaptive: true,
    },
    status: "SCHEDULED",
    questions: 0,
    answered: 0,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "Behavioural + Culture — FAANG Bar Raiser",
    description:
      "Duration-bounded bar-raiser round, currently in progress. Questions are generated adaptively as the interview runs.",
    type: "BEHAVIORAL",
    companyStyle: "FAANG",
    difficulty: "MEDIUM",
    durationMinutes: 40,
    createdDaysAgo: 0,
    createdHour: 9,
    meta: {
      jobRole: "Senior Software Engineer",
      domain: "General Engineering",
      experience: "5+ years",
      jobSkills: ["Collaboration", "Technical Leadership", "Communication"],
      targetedCompany: "Amazon",
      endingCriteria: "DURATION",
      questionCount: 6,
      maxFollowUps: 2,
      isAdaptive: true,
    },
    status: "INPROGRESS",
    questions: 6,
    answered: 3,
    timedOut: 0,
    skipped: 0,
    pending: 3,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "Incident Response Scenarios — MANGOS Style",
    description:
      "Hard mixed round built around production incident scenarios. Abandoned partway through by the candidate.",
    type: "MIXED",
    companyStyle: "MANGOS",
    difficulty: "HARD",
    durationMinutes: 60,
    createdDaysAgo: 12,
    createdHour: 20,
    meta: {
      jobRole: "Site Reliability Engineer",
      domain: "Reliability",
      experience: "4-8 years",
      jobSkills: ["Incident Response", "Observability", "Kubernetes"],
      targetedCompany: "Apple",
      endingCriteria: "DURATION",
      questionCount: 8,
      maxFollowUps: 1,
      isAdaptive: false,
    },
    status: "ABANDONED",
    questions: 4,
    answered: 2,
    timedOut: 0,
    skipped: 1,
    pending: 1,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "ML Fundamentals Screen",
    description:
      "Draft technical screen covering machine-learning fundamentals. Configuration saved but no questions generated yet.",
    type: "TECHNICAL",
    companyStyle: "REGULAR",
    difficulty: "MEDIUM",
    durationMinutes: 45,
    createdDaysAgo: 6,
    createdHour: 15,
    meta: {
      jobRole: "Machine Learning Engineer",
      domain: "Machine Learning",
      experience: "3-6 years",
      jobSkills: ["Python", "PyTorch", "Statistics", "Model Evaluation"],
      endingCriteria: "QUESTION_COUNT",
      questionCount: 6,
      maxFollowUps: 3,
      isAdaptive: true,
    },
    status: "DRAFT",
    questions: 0,
    answered: 0,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
];

/**
 * Optional extras (--status-extras) that complete the lifecycle spread so the
 * admin overview's interviewsByStatus map has a non-zero bucket for every
 * enum value.
 */
const STATUS_EXTRA_PLANS: InterviewPlan[] = [
  {
    title: "Ready To Start — Technical Warmup",
    description: "Configured and generated, waiting for the candidate to enter the lobby.",
    type: "TECHNICAL",
    companyStyle: "REGULAR",
    difficulty: "EASY",
    durationMinutes: 20,
    createdDaysAgo: 1,
    createdHour: 12,
    meta: {
      jobRole: "Junior Developer",
      domain: "General Engineering",
      experience: "0-2 years",
      jobSkills: ["JavaScript", "HTML", "CSS"],
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
      maxFollowUps: 0,
      isAdaptive: false,
    },
    status: "READY",
    questions: 5,
    answered: 0,
    timedOut: 0,
    skipped: 0,
    pending: 5,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "Timed Out — Data Structures Sprint",
    description: "Per-question timer expired on the opening question before an answer was submitted.",
    type: "TECHNICAL",
    companyStyle: "STARTUP",
    difficulty: "MEDIUM",
    durationMinutes: 15,
    createdDaysAgo: 9,
    createdHour: 19,
    meta: {
      jobRole: "Backend Engineer",
      domain: "Algorithms & Data Structures",
      experience: "1-4 years",
      jobSkills: ["Data Structures", "Complexity Analysis"],
      targetedCompany: "Atlassian",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 4,
      maxFollowUps: 1,
      isAdaptive: false,
    },
    status: "TIMED_OUT",
    questions: 4,
    answered: 0,
    timedOut: 1,
    skipped: 0,
    pending: 3,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "Expired — Behavioural Session",
    description: "Scheduled behavioural session that the candidate never joined within the window.",
    type: "BEHAVIORAL",
    companyStyle: "CUSTOM",
    difficulty: "MEDIUM",
    durationMinutes: 30,
    createdDaysAgo: 40,
    createdHour: 17,
    scheduledInDays: -33,
    meta: {
      jobRole: "Product Manager",
      domain: "Product",
      experience: "3-7 years",
      jobSkills: ["Stakeholder Management", "Roadmapping"],
      targetedCompanyOther: "Notion",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
      maxFollowUps: 2,
      isAdaptive: true,
    },
    status: "EXPIRED",
    questions: 0,
    answered: 0,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
  {
    title: "Cancelled — Culture Fit Screen",
    description: "Candidate cancelled ahead of the scheduled slot. No questions were generated.",
    type: "BEHAVIORAL",
    companyStyle: "REGULAR",
    difficulty: "EASY",
    durationMinutes: 25,
    createdDaysAgo: 27,
    createdHour: 15,
    scheduledInDays: -20,
    meta: {
      jobRole: "QA Engineer",
      domain: "Quality",
      experience: "1-3 years",
      jobSkills: ["Testing", "Communication"],
      endingCriteria: "DURATION",
      questionCount: 5,
      maxFollowUps: 1,
      isAdaptive: false,
    },
    status: "CANCELLED",
    questions: 0,
    answered: 0,
    timedOut: 0,
    skipped: 0,
    pending: 0,
    strengths: [],
    weaknesses: [],
    summary: "",
  },
];

function addDays(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function createdAtFor(plan: InterviewPlan): Date {
  const date = addDays(plan.createdDaysAgo);
  date.setHours(plan.createdHour, 15, 0, 0);
  return date;
}

interface ResolvedUser {
  id: string;
  email: string;
  label: string;
}

async function resolveUsers(preferredEmail?: string): Promise<ResolvedUser[]> {
  const db = getPgDb();

  if (preferredEmail) {
    const rows = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, preferredEmail))
      .limit(1);
    const found = rows[0];
    if (!found) {
      throw new Error(
        `No user with email "${preferredEmail}". Pass an existing account or omit --user to distribute across all users.`,
      );
    }
    console.log(`Seeding all interviews onto ${found.email}`);
    return [{ id: found.id, email: found.email, label: found.email }];
  }

  const existing = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .orderBy(asc(usersTable.createdAt));

  if (existing.length > 0) {
    console.log(`Distributing interviews across ${existing.length} existing user(s).`);
    return existing.map((user) => ({ id: user.id, email: user.email, label: user.email }));
  }

  console.log("No users found — creating demo accounts to own the seeded interviews.");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  const demoUsers = await db
    .insert(usersTable)
    .values([
      {
        email: "seed.candidate.one@synthview.dev",
        username: "seed_candidate_one",
        password: passwordHash,
        firstName: "Aditi",
        lastName: "Rao",
        isVerified: true,
        accountStatus: "active",
      },
      {
        email: "seed.candidate.two@synthview.dev",
        username: "seed_candidate_two",
        password: passwordHash,
        firstName: "Marcus",
        lastName: "Bell",
        isVerified: true,
        accountStatus: "active",
      },
      {
        email: "seed.candidate.three@synthview.dev",
        username: "seed_candidate_three",
        password: passwordHash,
        firstName: "Sofia",
        lastName: "Lindqvist",
        isVerified: true,
        accountStatus: "active",
      },
    ])
    .returning({ id: usersTable.id, email: usersTable.email });

  console.log(`Created ${demoUsers.length} demo users (password: ${SEED_PASSWORD}).`);
  return demoUsers.map((user) => ({ id: user.id, email: user.email, label: user.email }));
}

async function deletePreviousSeedRows(): Promise<number> {
  const db = getPgDb();
  const previous = await db
    .select({ id: interviewsTable.id })
    .from(interviewsTable)
    .where(like(interviewsTable.interviewTitle, `${SEED_PREFIX}%`));

  if (previous.length > 0) {
    await db.delete(interviewsTable).where(like(interviewsTable.interviewTitle, `${SEED_PREFIX}%`));
    console.log(`Removed ${previous.length} previously seeded interview(s) (cascades to children).`);
  }
  return previous.length;
}

interface SeededInterview {
  plan: InterviewPlan;
  user: ResolvedUser;
  createdAt: Date;
}

async function seedInterview(entry: SeededInterview, planIndex: number): Promise<string> {
  const db = getPgDb();
  const { plan, user, createdAt } = entry;
  const rng = createRng(0x5eed + planIndex * 7919);
  const durationSeconds = plan.durationMinutes * 60;

  const scheduledDate =
    plan.scheduledInDays === undefined ? null : addDays(-plan.scheduledInDays);
  if (scheduledDate) {
    scheduledDate.setHours(plan.createdHour + 1, 0, 0, 0);
  }

  const startedAt =
    plan.status === "INPROGRESS"
      ? new Date(Date.now() - 40 * 60 * 1000)
      : plan.status === "ABANDONED"
        ? new Date(createdAt.getTime() + 6 * 60 * 1000)
        : plan.status === "COMPLETED"
          ? new Date(createdAt.getTime() + 2 * 60 * 1000)
          : null;

  const finishedAt = plan.status === "COMPLETED" ? new Date(createdAt.getTime() + durationSeconds * 1000) : null;

  const [interview] = await db
    .insert(interviewsTable)
    .values({
      userId: user.id,
      interviewTitle: `${SEED_PREFIX}${plan.title}`,
      interviewDescription: plan.description,
      interviewType: plan.type,
      interviewCompanyStyle: plan.companyStyle,
      interviewDifficulty: plan.difficulty,
      interviewDuration: plan.durationMinutes,
      interviewMetaData: plan.meta,
      interviewStatus: plan.status,
      isInterviewScheduled: scheduledDate !== null,
      interviewScheduledDate: scheduledDate,
      interviewStartedAt: startedAt,
      lastActivityAt: finishedAt ?? startedAt ?? createdAt,
      reminder24hSentAt: scheduledDate ? new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000) : null,
      reminder1hSentAt: scheduledDate ? new Date(scheduledDate.getTime() - 60 * 60 * 1000) : null,
      interviewQuestionsGeneratedCount: plan.questions > 0 ? plan.questions : null,
      interviewQuestionsAnsweredCount: plan.answered > 0 ? plan.answered : null,
      createdAt,
      updatedAt: finishedAt ?? createdAt,
    })
    .returning({ id: interviewsTable.id });

  if (!interview) {
    throw new Error(`Failed to insert interview "${plan.title}"`);
  }
  const interviewId = interview.id;

  if (plan.questions === 0) {
    return interviewId;
  }

  // Build the question lifecycle: answered → timed out → skipped → pending.
  const pool = POOLS[plan.type];
  const poolOffset = (planIndex * 3) % pool.length;
  const questionRows = Array.from({ length: plan.questions }, (_, index) => {
    const template = pool[(poolOffset + index) % pool.length]!;
    const isAnswered = index < plan.answered;
    const isTimedOut = !isAnswered && index < plan.answered + plan.timedOut;
    const isSkipped = !isAnswered && !isTimedOut && index < plan.answered + plan.timedOut + plan.skipped;

    const questionState = isAnswered
      ? ("EVALUATED" as const)
      : isTimedOut
        ? ("TIMED_OUT" as const)
        : isSkipped
          ? ("SKIPPED" as const)
          : ("PENDING" as const);

    const answeredOffset = isAnswered ? 60 + Math.round(rng() * 120) : 0;
    const askedAt = new Date(createdAt.getTime() + index * 90 * 1000);

    return {
      interviewId,
      sequenceNumber: index + 1,
      questionTitle: template.title,
      questionDescription: template.description,
      questionType:
        plan.type === "MIXED" ? (index % 2 === 0 ? ("MIXED" as const) : ("TECHNICAL" as const)) : plan.type,
      questionState,
      timedOutAt: isTimedOut ? new Date(askedAt.getTime() + 120 * 1000) : null,
      timeoutBehavior: isTimedOut ? ("PENALISE" as const) : null,
      createdAt: askedAt,
      updatedAt: new Date(askedAt.getTime() + (isAnswered ? answeredOffset * 1000 : 30 * 1000)),
    };
  });

  const insertedQuestions = await db
    .insert(interviewQuestionsTable)
    .values(questionRows)
    .returning({ id: interviewQuestionsTable.id, sequenceNumber: interviewQuestionsTable.sequenceNumber });

  const questionIds = new Map(insertedQuestions.map((q) => [q.sequenceNumber, q.id]));
  const questionWiseScore: { questionId: string; score: number; answerId?: string }[] = [];

  const answerRows: {
    interviewId: string;
    questionId: string;
    answerData: string;
    answerType: "TEXT" | "AUDIO" | "VIDEO";
    answerState: "RECEIVED" | "PERSISTED" | "EVALUATED";
    evaluationData: {
      score: number;
      correctness: number;
      relevance: number;
      clarity: number;
      technicalDepth: number;
      feedback: string;
      strengths: string[];
      weaknesses: string[];
    };
    answeredAt: Date;
    timeTakenSeconds: number;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  for (let index = 0; index < plan.answered; index += 1) {
    const questionId = questionIds.get(index + 1);
    if (!questionId) continue;

    const baseScore = plan.scores?.overall ?? 65;
    // Slight upward drift across the interview keeps the per-question series
    // from looking like noise while still varying between rounds.
    const questionScore = clampScore(baseScore + (rng() - 0.5) * 16 + index * 0.8);
    const correctness = clampScore(questionScore + (rng() - 0.5) * 12);
    const relevance = clampScore(questionScore + (rng() - 0.5) * 10);
    const clarity = clampScore(questionScore + (rng() - 0.5) * 14);
    const technicalDepth = clampScore(questionScore + (rng() - 0.5) * 16);
    const feedback = pickFeedback(rng, questionScore);
    const isBehavioural = plan.type === "BEHAVIORAL";
    const askedAt = new Date(createdAt.getTime() + index * 90 * 1000);
    const answeredAt = new Date(askedAt.getTime() + (60 + Math.round(rng() * 150)) * 1000);

    answerRows.push({
      interviewId,
      questionId,
      answerData: isBehavioural
        ? `Situation: a cross-team delivery was slipping. Task: I owned the recovery plan. Action: I re-sequenced the work into weekly checkpoints and renegotiated scope with the stakeholder. Result: we shipped two weeks later than planned but with the full feature set and no follow-up defects. (seed answer ${index + 1})`
        : `I would start from the requirements and the failure modes rather than the components. First I would clarify the read/write ratio and the consistency requirement, then pick a data model that makes the hot path cheap, add caching in front of it, and design the write path so retries stay idempotent. (seed answer ${index + 1})`,
      answerType: isBehavioural && index % 3 === 2 ? "AUDIO" : "TEXT",
      answerState: "EVALUATED",
      evaluationData: {
        score: questionScore,
        correctness,
        relevance,
        clarity,
        technicalDepth,
        feedback,
        strengths: plan.strengths.slice(0, 2),
        weaknesses: plan.weaknesses.slice(0, 1),
      },
      answeredAt,
      timeTakenSeconds: Math.round((answeredAt.getTime() - askedAt.getTime()) / 1000),
      createdAt: answeredAt,
      updatedAt: answeredAt,
    });
  }

  if (answerRows.length > 0) {
    const insertedAnswers = await db
      .insert(interviewAnswersTable)
      .values(answerRows)
      .returning({
        id: interviewAnswersTable.id,
        questionId: interviewAnswersTable.questionId,
        evaluationData: interviewAnswersTable.evaluationData,
      });

    const evaluationRows = insertedAnswers.map((answer) => {
      const evaluation = answer.evaluationData!;
      questionWiseScore.push({
        questionId: answer.questionId,
        answerId: answer.id,
        score: evaluation.score,
      });
      return {
        interviewId,
        questionId: answer.questionId,
        answerId: answer.id,
        score: money(evaluation.score),
        correctnessScore: money(evaluation.correctness),
        relevanceScore: money(evaluation.relevance),
        clarityScore: money(evaluation.clarity),
        depthScore: money(evaluation.technicalDepth),
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        createdAt: createdAt,
        updatedAt: createdAt,
      };
    });

    await db.insert(answerEvaluationTable).values(evaluationRows);
  }

  if (plan.status === "COMPLETED" && plan.scores && plan.verdict) {
    const resultCreatedAt = finishedAt ?? createdAt;

    await db.insert(interviewResultsTable).values({
      interviewId,
      overallScore: money(plan.scores.overall),
      technicalScore: money(plan.scores.technical),
      communicationScore: money(plan.scores.communication),
      problemSolvingScore: money(plan.scores.problemSolving),
      confidenceScore: money(plan.scores.confidence),
      questionsAnswered: plan.answered,
      questionsSkipped: plan.skipped + plan.timedOut,
      questionsEvaluated: plan.answered,
      totalDuration: durationSeconds,
      feedback: plan.summary,
      strengths: plan.strengths,
      weaknesses: plan.weaknesses,
      createdAt: resultCreatedAt,
      updatedAt: resultCreatedAt,
    });

    await db
      .update(interviewsTable)
      .set({
        interviewOutcome: {
          finalScore: plan.scores.overall,
          finalVerdict: plan.verdict,
          questionWiseScore,
          finalFeedBack: plan.summary,
          // Built conditionally: `exactOptionalPropertyTypes` rejects an
          // explicit `undefined` for these optional jsonb keys.
          ...(plan.improvements !== undefined && { suggestedImprovements: plan.improvements }),
          ...(plan.resources !== undefined && { helpfulResources: plan.resources }),
        },
      })
      .where(eq(interviewsTable.id, interviewId));
  }

  return interviewId;
}

async function syncUserInterviewCounts(userIds: string[]): Promise<void> {
  const db = getPgDb();
  for (const userId of [...new Set(userIds)]) {
    const rows = await db
      .select({ value: count() })
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, userId));
    await db
      .update(usersTable)
      .set({ interviewCount: Number(rows[0]?.value ?? 0) })
      .where(eq(usersTable.id, userId));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const withStatusExtras = args.includes("--status-extras");
  const userFlagIndex = args.indexOf("--user");
  const preferredEmail = userFlagIndex >= 0 ? args[userFlagIndex + 1] : undefined;

  const plans = withStatusExtras ? [...PLANS, ...STATUS_EXTRA_PLANS] : PLANS;

  await deletePreviousSeedRows();
  const users = await resolveUsers(preferredEmail);

  const seeded: SeededInterview[] = [];
  plans.forEach((plan, index) => {
    const pinned = plan.userEmail
      ? users.find((candidate) => candidate.email === plan.userEmail)
      : undefined;
    const user = pinned ?? users[index % users.length]!;
    seeded.push({ plan, user, createdAt: createdAtFor(plan) });
  });

  console.log(`\nInserting ${seeded.length} interviews...\n`);

  for (const [index, entry] of seeded.entries()) {
    await seedInterview(entry, index);
    const score =
      entry.plan.scores !== undefined ? entry.plan.scores.overall.toFixed(2).padStart(6) : "     -";
    const config = `${entry.plan.type.padEnd(10)} ${entry.plan.companyStyle.padEnd(8)} ${entry.plan.difficulty.padEnd(6)} ${entry.plan.meta.endingCriteria.padEnd(14)} fu=${entry.plan.meta.maxFollowUps} adaptive=${entry.plan.meta.isAdaptive ? "y" : "n"}`;
    console.log(
      `${String(index + 1).padStart(2)}. ${entry.plan.status.padEnd(11)} score=${score}  ${config}  → ${entry.user.label}`,
    );
  }

  await syncUserInterviewCounts(seeded.map((entry) => entry.user.id));

  const byStatus = new Map<string, number>();
  for (const entry of seeded) {
    byStatus.set(entry.plan.status, (byStatus.get(entry.plan.status) ?? 0) + 1);
  }

  console.log(`\nDone. ${seeded.length} interviews seeded.`);
  console.log(
    `Status distribution: ${[...byStatus.entries()]
      .map(([status, total]) => `${status}=${total}`)
      .join(", ")}`,
  );
  if (!withStatusExtras) {
    console.log("Tip: re-run with `-- --status-extras` to also populate READY/TIMED_OUT/EXPIRED/CANCELLED.");
  }
  console.log(
    "Note: analytics responses are cached in Redis for 5 minutes — flush the `analytics:user:*` keys if a page looks stale.",
  );
}

main()
  .then(async () => {
    await getPgPool().end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seeding failed:", err);
    try {
      await getPgPool().end();
    } catch {
      // Pool may never have been created — nothing to close.
    }
    process.exit(1);
  });
