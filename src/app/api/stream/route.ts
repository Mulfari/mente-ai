import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const vpsRes = await fetch(`${VPS_URL}/api/stream?${url.searchParams.toString()}`, {
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

    // Read the entire body as text, then stream it back
    const bodyText = await vpsRes.text();

    return new Response(bodyText, {
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