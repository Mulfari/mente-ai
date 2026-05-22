import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";
const SHARED_SECRET = process.env.VPS_SHARED_SECRET || "";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query string for VPS
    const params = new URLSearchParams();
    for (const [key, value] of searchParams) {
      params.set(key, value);
    }

    // Forward to VPS, which handles its own auth via the token param
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

    // Stream SSE directly to browser
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