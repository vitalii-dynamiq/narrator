// Client-side catalog of conversations. The content (messages, sections,
// evidence) lives on the server (`lib/agents/conversations.ts`) and replays
// via the existing SSE event buffer. This file only tracks what rows to show
// in the sidebar and how to navigate back to them.

export interface ChatEntry {
  /** Server-issued conversationId — stable, used as the deep-link anchor. */
  id: string;
  /** Truncated first question for the sidebar row (≤ 60 chars + ellipsis). */
  title: string;
  /** Full first question — used by the "expired" fallback to re-kick cleanly. */
  firstQuestion: string;
  createdAt: number;
  /** Bumped on every follow-up turn so recency sort stays accurate. */
  updatedAt: number;
}

/** Shape returned by GET /api/conversations/[id] on 200. */
export interface ConversationTranscript {
  id: string;
  createdAt: number;
  updatedAt: number;
  turns: Array<{
    runId: string;
    question: string;
    createdAt: number;
  }>;
}
