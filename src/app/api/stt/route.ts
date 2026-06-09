// /api/stt — speech-to-text proxy. Prefers Deepgram Nova-3 (best for
// Venezuelan Spanish) and falls back to ElevenLabs Scribe if no Deepgram
// key is set.
//
// Browser uploads audio (webm/opus from MediaRecorder) to this route;
// the route forwards to the STT provider and returns the transcript JSON.
//
// Why proxy: the API key never goes to the browser. The browser only
// sees our /api/stt which is server-to-server authenticated.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

export async function POST(req: NextRequest) {
  if (!DEEPGRAM_API_KEY && !ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "STT no configurado (falta DEEPGRAM_API_KEY o ELEVENLABS_API_KEY)" },
      { status: 503 }
    );
  }

  // Get the audio blob from the browser. MediaRecorder sends it as
  // 'audio/webm' or 'audio/ogg' or 'audio/mp4' depending on browser.
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("audio") || form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "audio file missing" }, { status: 400 });
  }
  const lang = (form.get("language") as string) || "es";
  const provider = DEEPGRAM_API_KEY ? "deepgram" : "elevenlabs";

  // Scribe/Deepgram return transcription in 1-3s typically. 30s max in case
  // of long recordings (user holds mic for a long message).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    if (DEEPGRAM_API_KEY) {
      // Deepgram: send raw audio bytes with model+language in the URL.
      // nova-3 is their latest, trained on LATAM Spanish. smart_format
      // auto-punctuates. Returns a tree of channels/alternatives.
      const url = new URL("https://api.deepgram.com/v1/listen");
      url.searchParams.set("model", "nova-3");
      url.searchParams.set("language", lang);
      url.searchParams.set("smart_format", "true");
      url.searchParams.set("punctuate", "true");
      url.searchParams.set("mimetype", (file as any).type || "audio/webm");

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": (file as any).type || "audio/webm",
        },
        body: file,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.error("[stt] deepgram error:", r.status, errText.slice(0, 200));
        return NextResponse.json(
          { error: "deepgram failed", upstream: r.status, body: errText.slice(0, 200) },
          { status: 502 }
        );
      }

      const data = await r.json();
      const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      const detectedLang = data?.results?.channels?.[0]?.detected_language || lang;
      return NextResponse.json({
        text: text.trim(),
        language: detectedLang,
        provider: "deepgram",
      });
    } else {
      // ElevenLabs Scribe fallback
      const upstream = new FormData();
      upstream.append("file", file, (file as any).name || "recording.webm");
      upstream.append("model_id", "scribe_v1");
      upstream.append("language_code", lang);

      const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
        body: upstream,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.error("[stt] scribe error:", r.status, errText.slice(0, 200));
        return NextResponse.json(
          { error: "scribe failed", upstream: r.status, body: errText.slice(0, 200) },
          { status: 502 }
        );
      }

      const data = await r.json();
      return NextResponse.json({
        text: (data.text || "").trim(),
        language: data.language_code || lang,
        provider: "elevenlabs",
      });
    }
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "stt timed out" }, { status: 504 });
    }
    console.error("[stt] error:", err);
    return NextResponse.json(
      { error: "stt error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
