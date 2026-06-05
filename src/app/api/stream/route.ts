import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const body = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const vpsRes = await fetch(`${VPS_URL}/api/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body),
        });

        if (!vpsRes.ok || !vpsRes.body) {
          let errBody = "";
          try { errBody = await vpsRes.text(); } catch {}
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: `VPS error ${vpsRes.status}: ${errBody}` })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const reader = vpsRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: err.message || "Error de conexion" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
