// ── Reused vendor SDK clients ─────────────────────────────────────────────────
// Why this module exists: constructing an SDK client is not free. Every
// `new Groq(...)` / `new Mistral(...)` builds its own HTTP agent and connection
// pool, so a client constructed per call pays a fresh DNS lookup, TCP connect and
// TLS handshake to the vendor on *every* generate / evaluate / embed. That is
// tens to hundreds of milliseconds per call that has nothing to do with the model,
// and it multiplies across the 2–3 model calls a single interview turn makes
// (generate, evaluate, and the pre-generated look-ahead question).
//
// Two things are cached, separately and deliberately:
//   - the resolved module, so a call path never re-resolves the specifier after
//     the first import
//   - the client instance, keyed by the API key it was built with, so a rotated
//     key (or a test that swaps the env module) still gets a correctly configured
//     client instead of a stale one
//
// The dynamic import is kept for the reason it was introduced: a deployment with
// no Groq key never loads the Groq SDK at all, and `isReady()` in provider.ts
// already guarantees a client is only ever requested for a provider whose key is
// present.

import { env } from "../../config/env.js";

type GroqModule = typeof import("groq-sdk");
type MistralModule = typeof import("@mistralai/mistralai");

export type GroqClient = InstanceType<GroqModule["default"]>;
export type MistralClient = InstanceType<MistralModule["Mistral"]>;

let groqModule: Promise<GroqModule> | null = null;
let mistralModule: Promise<MistralModule> | null = null;

function importGroqModule(): Promise<GroqModule> {
  groqModule ??= import("groq-sdk");
  return groqModule;
}

function importMistralModule(): Promise<MistralModule> {
  mistralModule ??= import("@mistralai/mistralai");
  return mistralModule;
}

let groqClient: { apiKey: string | undefined; client: GroqClient } | null = null;
let mistralClient: { apiKey: string | undefined; client: MistralClient } | null = null;

/** The Groq client for the configured key — built once, then reused for the process lifetime. */
export async function getGroqClient(): Promise<GroqClient> {
  if (groqClient && groqClient.apiKey === env.GROQ_API_KEY) return groqClient.client;
  const { default: Groq } = await importGroqModule();
  const client = new Groq({ apiKey: env.GROQ_API_KEY });
  groqClient = { apiKey: env.GROQ_API_KEY, client };
  return client;
}

/** The Mistral client for the configured key — shared by chat completions and embeddings. */
export async function getMistralClient(): Promise<MistralClient> {
  if (mistralClient && mistralClient.apiKey === env.MISTRAL_API_KEY) return mistralClient.client;
  const { Mistral } = await importMistralModule();
  const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
  mistralClient = { apiKey: env.MISTRAL_API_KEY, client };
  return client;
}
