// /api/tts — proxy on Vercel to the VPS orchestrator's /api/tts endpoint.
//
// Why: the browser is on HTTPS (mulfai.com.ve via Vercel) but the VPS
// orchestrator is plain HTTP (177.7.46.156:3000). Direct browser→VPS calls
// are blocked as mixed content. This route runs server-to-server (no
// mixed content restriction), forwards the request, and streams the audio
// binary back to the browser.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";
const TTS_PATH = "/api/tts";
// Kokoro can take a while for long messages. Synth is ~1.7s for 3s audio
// on the VPS CPU; allow up to 60s for very long messages.
const UPSTREAM_TIMEOUT_MS = 60_000;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = (body?.text || "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long (max 4000 chars)" }, { status: 400 });
  }

  // Forward to VPS orchestrator. Server-to-server so no mixed-content.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${VPS_URL}${TTS_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: body.voice || "ef_dora",
        format: body.format || "mp3",
        speed: body.speed || 1.0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("[tts-proxy] upstream error:", upstream.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "upstream tts failed", upstream: upstream.status },
        { status: 502 }
      );
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") || "audio/mpeg";
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Length": String(audio.length),
        "Cache-Control": "public, max-age=3600",
        "X-Synth-Time": upstream.headers.get("X-Synth-Time") || "",
      },
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "tts timed out" }, { status: 504 });
    }
    console.error("[tts-proxy] error:", err);
    return NextResponse.json(
      { error: "tts proxy error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
