import { subscribe, getRunSnapshot } from "@/lib/agents/runtime";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const snapshot = getRunSnapshot(runId);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: "run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      // Replay buffered events first
      for (const ev of snapshot.events) {
        write(ev);
      }
      // Subscribe to future
      const unsub = subscribe(runId, (ev) => {
        try {
          write(ev);
          if (ev.type === "run_completed" || ev.type === "run_failed") {
            // Let the client close; also auto-close after a grace period
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // ignore
              }
            }, 500);
          }
        } catch {
          // ignore
        }
      });

      // Heartbeat every 25s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const cleanup = () => {
        unsub();
        clearInterval(heartbeat);
      };
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      // Connection closed by client — cleanup handled via GC
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
