// /api/tts — proxy on Vercel that calls ElevenLabs (preferred) or falls
// back to local Kokoro on the VPS.
//
// Why a proxy: the browser is on HTTPS (mulfai.com.ve via Vercel) and we
// don't want the API key exposed in client JS. This route runs
// server-to-server, holds the key, and returns audio/mpeg to the browser.
//
// Provider order:
//   1. ElevenLabs (ELEVENLABS_API_KEY set) — best quality, ~$5/mes for low traffic
//   2. Kokoro on VPS (KOKORO_TTS_URL or VPS_ORCHESTRATOR_URL set) — free local TTS

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah — Mature, Reassuring, Confident. Multilingual v2 sounds great in Spanish.
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5"; // fast, low latency, multilingual

const KOKORO_URL =
  process.env.KOKORO_TTS_URL ||
  (process.env.VPS_ORCHESTRATOR_URL
    ? `${process.env.VPS_ORCHESTRATOR_URL.replace(/\/+$/, "")}/api/tts`
    : "");
const TTS_PATH = "";
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

  // Build the upstream URL.
  const useElevenLabs = !!ELEVENLABS_API_KEY;
  const upstreamUrl = useElevenLabs
    ? `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`
    : (KOKORO_URL || "").replace(/\/+$/, "") + TTS_PATH;
  console.log(`[tts-proxy] using ${useElevenLabs ? "elevenlabs" : "kokoro"} → ${upstreamUrl.replace(ELEVENLABS_API_KEY, "[REDACTED]")}`);

  try {
    let upstream: Response;
    if (useElevenLabs) {
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      });
    } else {
      upstream = await fetch(upstreamUrl, {
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
    }
    clearTimeout(timer);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("[tts-proxy] upstream error:", upstream.status, "url:", upstreamUrl, "body:", errText.slice(0, 200));
      return NextResponse.json(
        { error: "upstream tts failed", upstream: upstream.status, url: useElevenLabs ? "[elevenlabs]" : upstreamUrl, body: errText.slice(0, 200) },
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
        "X-TTS-Provider": useElevenLabs ? "elevenlabs" : "kokoro",
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
