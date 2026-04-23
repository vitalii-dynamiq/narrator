// In-memory conversation store. Backs multi-turn Ask UNITY chat: each call to
// `/api/reports` may pass a `conversationId`; if present, the new run receives
// the prior turns' messages (user + assistant, including thinking signatures
// and tool_use/tool_result pairs) so Opus 4.7 has full context for follow-ups.
//
// Not persisted across process restarts. For a prototype push this is fine; in
// production, back this onto Redis / Postgres without changing the interface.

import type Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";

export interface ConversationTurn {
  /** 1-based index within the conversation. */
  index: number;
  runId: string;
  question: string;
  /** Wall-clock when this turn was created. */
  createdAt: number;
}

export interface ConversationState {
  id: string;
  createdAt: number;
  updatedAt: number;
  turns: ConversationTurn[];
  /**
   * Accumulated messages — everything the next run needs to see to carry
   * context forward. Includes prior user questions and prior assistant
   * content (thinking blocks, server_tool_use + code_execution_tool_result
   * pairs, and client tool_use + tool_result pairs).
   */
  messages: Anthropic.MessageParam[];
}

const store = new Map<string, ConversationState>();

const MAX_CONVERSATIONS = 128;
const EVICTION_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function evictOld(): void {
  const now = Date.now();
  for (const [id, conv] of store) {
    if (now - conv.updatedAt > EVICTION_AGE_MS) store.delete(id);
  }
  // Hard cap on size in case a lot of short-lived conversations pile up.
  if (store.size > MAX_CONVERSATIONS) {
    const sorted = [...store.entries()].sort(
      ([, a], [, b]) => a.updatedAt - b.updatedAt
    );
    const toEvict = sorted.slice(0, store.size - MAX_CONVERSATIONS);
    for (const [id] of toEvict) store.delete(id);
  }
}

/** Return existing conversation or create a new one. */
export function getOrCreate(
  conversationId: string | undefined
): ConversationState {
  evictOld();
  if (conversationId) {
    const existing = store.get(conversationId);
    if (existing) return existing;
  }
  const id = conversationId ?? `conv_${nanoid(10)}`;
  const conv: ConversationState = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turns: [],
    messages: [],
  };
  store.set(id, conv);
  return conv;
}

/** Append a new turn. Call before the orchestrator run. */
export function appendTurn(
  conversationId: string,
  runId: string,
  question: string
): ConversationTurn {
  const conv = getOrCreate(conversationId);
  const turn: ConversationTurn = {
    index: conv.turns.length + 1,
    runId,
    question,
    createdAt: Date.now(),
  };
  conv.turns.push(turn);
  conv.updatedAt = Date.now();
  return turn;
}

/** Replace the full messages array — called after each run completes. */
export function commitMessages(
  conversationId: string,
  messages: Anthropic.MessageParam[]
): void {
  const conv = store.get(conversationId);
  if (!conv) return;
  conv.messages = messages;
  conv.updatedAt = Date.now();
}

export function getConversation(
  conversationId: string
): ConversationState | undefined {
  return store.get(conversationId);
}

export function listRecent(limit = 10): ConversationState[] {
  return [...store.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
