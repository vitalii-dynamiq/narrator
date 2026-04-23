"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import { useChatHistory } from "@/lib/chat-history/store";

export function ConversationsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const entries = useChatHistory((s) => s.entries);
  const hydrated = useChatHistory((s) => s.hydrated);
  const hydrate = useChatHistory((s) => s.hydrate);
  const remove = useChatHistory((s) => s.remove);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const activeId = pathname === "/ask" ? searchParams.get("conv") : null;

  const onDelete = (id: string) => {
    remove(id);
    if (activeId === id) {
      router.push("/ask");
    }
  };

  return (
    <div className="px-3 pb-4">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Conversations
        </div>
        <Link
          href="/ask"
          className="rounded-md hover:bg-sidebar-accent p-1 transition"
          aria-label="New conversation"
          title="New conversation"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </Link>
      </div>

      {hydrated && entries.length === 0 && (
        <div className="px-2 py-2 text-[11.5px] text-muted-foreground/80 italic">
          No conversations yet. Ask UNITY anything.
        </div>
      )}

      <ul className="space-y-0.5">
        {entries.map((e) => {
          const active = activeId === e.id;
          return (
            <li key={e.id} className="group">
              <div
                className={`flex items-center gap-2 rounded-md pl-2 pr-1 py-1.5 text-[12px] transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <Link
                  href={`/ask?conv=${encodeURIComponent(e.id)}`}
                  className="flex-1 min-w-0 truncate"
                  title={e.firstQuestion}
                >
                  {e.title}
                </Link>
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onDelete(e.id);
                  }}
                  aria-label={`Delete ${e.title}`}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
