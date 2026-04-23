// Thin wrapper around the Anthropic SDK. Production mode only — no silent
// fallback when ANTHROPIC_API_KEY is missing. Missing key surfaces as a
// visible run_failed event in the UI.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
    this.name = "MissingApiKeyError";
  }
}

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (!client) client = new Anthropic();
  return client;
}

export const MODELS = {
  OPUS: "claude-opus-4-7" as const,
  SONNET: "claude-sonnet-4-6" as const,
  HAIKU: "claude-haiku-4-5" as const,
};

export const CODE_EXECUTION_TOOL = {
  type: "code_execution_20260120" as const,
  name: "code_execution" as const,
};

// Required beta header for the `code_execution_20260120` tool on Opus 4.7.
export const CODE_EXECUTION_BETA = "code-execution-2026-01-20" as const;
