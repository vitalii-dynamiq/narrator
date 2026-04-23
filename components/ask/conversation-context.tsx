"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Carries the active chat's conversationId down to citation chips and cell
 * inspectors so "Explain this number" lands back in the same conversation.
 *
 * Outside an Ask UNITY chat (e.g. the Variance or Valuation pages where cells
 * are also inspectable), the value is null and Explain will open a fresh
 * chat — which is the right default for a one-off drill-down.
 */
const ConversationIdContext = createContext<string | null>(null);

export function ConversationIdProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}) {
  return (
    <ConversationIdContext.Provider value={value}>{children}</ConversationIdContext.Provider>
  );
}

export function useConversationId(): string | null {
  return useContext(ConversationIdContext);
}
