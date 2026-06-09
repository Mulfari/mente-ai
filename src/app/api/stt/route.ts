// /api/stt — speech-to-text proxy using ElevenLabs Scribe.
//
// Browser uploads audio (webm/opus from MediaRecorder) to this route;
// the route forwards to ElevenLabs Scribe and returns the transcript JSON.
//
// Why proxy: the ElevenLabs API key never goes to the browser. The browser
// only sees our /api/stt which is server-to-server authenticated.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
// Scribe v1 supports es natively; setting language_code makes it skip
// language detection (faster + more accurate for our use case).
const SCRIBE_MODEL = "scribe_v1";
const SCRIBE_LANG = "es"; // es-VE not in the official list, "es" covers all variants

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "STT no configurado (falta ELEVENLABS_API_KEY)" },
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
  const lang = (form.get("language") as string) || SCRIBE_LANG;

  // Build a new FormData for the upstream call. ElevenLabs expects
  // 'file' field (not 'audio'), and 'model_id' as a separate field.
  const upstream = new FormData();
  upstream.append("file", file, (file as any).name || "recording.webm");
  upstream.append("model_id", SCRIBE_MODEL);
  upstream.append("language_code", lang);

  // Scribe returns transcription in 1-3s typically. 30s max in case of long
  // recordings (user holds mic for a long message).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: upstream,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("[stt] upstream error:", r.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "scribe failed", upstream: r.status, body: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await r.json();
    // Scribe response: { text, language_code, words: [{text, start, end, type}] }
    return NextResponse.json({
      text: data.text || "",
      language: data.language_code || lang,
      words: data.words || [],
    });
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
