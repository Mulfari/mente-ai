import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const vpsRes = await fetch(`${VPS_URL}/api/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });

    if (!vpsRes.ok) {
      const bodyText = await vpsRes.text().catch(() => "");
      return NextResponse.json(
        { error: `VPS error ${vpsRes.status}: ${bodyText}` },
        { status: vpsRes.status }
      );
    }

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