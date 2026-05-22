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

    // Return VPS body directly with SSE headers
    // Node.js 24 (Vercel) supports ReadableStream in Response
    return new Response(vpsRes.body, {
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