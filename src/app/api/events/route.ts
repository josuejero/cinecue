import { getServerEnv } from "@/lib/env";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import {
  formatSseComment,
  formatSseEvent,
  getLatestAvailabilityCursor,
} from "@/lib/phase5/sse";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);

    await assertRateLimit({
      request,
      scope: "events.sse",
      subject: `${user.id}:${location.locationId}`,
      limit: 12,
      windowSeconds: 60,
    });

    const env = getServerEnv();
    const encoder = new TextEncoder();

    let currentCursor = await getLatestAvailabilityCursor({
      userId: user.id,
      locationId: location.locationId,
    });

    let closed = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let heartbeatHandle: ReturnType<typeof setInterval> | null = null;
    let abortCleanup: (() => void) | null = null;

    const cleanup = (controller?: ReadableStreamDefaultController<Uint8Array>) => {
      if (closed) {
        return;
      }

      closed = true;

      if (pollHandle) {
        clearInterval(pollHandle);
      }

      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
      }

      if (abortCleanup) {
        abortCleanup();
      }

      controller?.close();
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enqueue = (value: string) => {
          if (!closed) {
            controller.enqueue(encoder.encode(value));
          }
        };

        const poll = async () => {
          if (closed) {
            return;
          }

          try {
            const nextCursor = await getLatestAvailabilityCursor({
              userId: user.id,
              locationId: location.locationId,
            });

            if (nextCursor && nextCursor !== currentCursor) {
              currentCursor = nextCursor;

              enqueue(
                formatSseEvent("dashboard-refresh", {
                  locationId: location.locationId,
                  cursor: currentCursor,
                  at: new Date().toISOString(),
                }),
              );
            }
          } catch (error) {
            enqueue(
              formatSseEvent("stream-error", {
                message:
                  error instanceof Error ? error.message : "Unknown SSE error.",
              }),
            );
          }
        };

        enqueue("retry: 10000\n\n");
        enqueue(
          formatSseEvent("connected", {
            locationId: location.locationId,
            cursor: currentCursor,
            at: new Date().toISOString(),
          }),
        );

        pollHandle = setInterval(() => {
          void poll();
        }, env.PHASE5_SSE_POLL_MS);

        heartbeatHandle = setInterval(() => {
          enqueue(formatSseComment(`heartbeat ${Date.now()}`));
        }, env.PHASE5_SSE_HEARTBEAT_MS);

        const abortHandler = () => {
          cleanup(controller);
        };

        request.signal.addEventListener("abort", abortHandler, { once: true });
        abortCleanup = () => {
          request.signal.removeEventListener("abort", abortHandler);
        };
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
