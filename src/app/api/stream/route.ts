import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams(searchParams.toString());
    const vpsUrl = `${VPS_URL}/api/stream?${params.toString()}`;

    const vpsRes = await fetch(vpsUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      signal: AbortSignal.timeout(300_000),
    });

    if (!vpsRes.ok) {
      const body = await vpsRes.text().catch(() => "");
      return NextResponse.json(
        { error: `VPS error ${vpsRes.status}: ${body}` },
        { status: vpsRes.status }
      );
    }

    // Pipe VPS stream to browser using a custom ReadableStream
    const reader = vpsRes.body!.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let result = await reader.read();
          while (!result.done) {
            controller.enqueue(result.value);
            result = await reader.read();
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error de conexion con el servidor" },
      { status: 500 }
    );
  }
}