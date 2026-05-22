import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "missing";
    const messageId = url.searchParams.get("message_id") || "missing";
    const question = url.searchParams.get("question") || "missing";
    console.error(`[stream] token=${token.substring(0,20)}... msgId=${messageId} question=${question}`);

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