"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// === Idioma (re-exported from voice.ts for compatibility) ===
export type VoiceLang = "es-VE" | "es-ES" | "es-MX" | "en-US" | "auto";

const LANG_KEY = "vechat-voice-lang";

export function getStoredLang(): VoiceLang {
  if (typeof window === "undefined") return "es-VE";
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === "es-VE" || stored === "es-ES" || stored === "es-MX" || stored === "en-US" || stored === "auto") {
    return stored;
  }
  return "es-VE";
}

export function setStoredLang(lang: VoiceLang) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, lang);
}

// === useSpeechSynthesisServer ===
// Reemplaza useSpeechSynthesis (Web Speech API) con audio de Kokoro TTS
// corriendo en el VPS. Misma interfaz pública, así MessageBubble.tsx no
// necesita cambios funcionales. Devuelve MP3 desde /api/tts del orchestrator
// y lo reproduce con HTML5 Audio.
//
// Calidad: humana (top 2 mundial en TTS Arena). Costo: $0 (modelo local
// en el VPS, 2 cores, real-time factor ~0.6 → 5s de audio en ~3s).
//
// Estados que expone (además de los del Web Speech API):
//   - isLoading: true mientras se hace el fetch al VPS (típicamente 1-3s)
//   - error: mensaje si algo falla (TTS caído, sin red, etc.)
//
// Diferencias vs Web Speech API:
//   - El "boundary" event (resaltar palabra por palabra) ya no existe —
//     usamos timeupdate y estimamos charIndex proporcional.

type UseSpeechSynthesisOptions = {
  lang?: VoiceLang;
};

// TTS endpoint: prefer the Vercel proxy at /api/tts (works around mixed
// content — the page is HTTPS but the VPS is HTTP). Set
// NEXT_PUBLIC_TTS_ENDPOINT to override (e.g. for local dev pointing at
// the VPS directly).
const TTS_ENDPOINT = process.env.NEXT_PUBLIC_TTS_ENDPOINT || "/api/tts";
const DEFAULT_VOICE = "ef_dora"; // Kokoro Spanish female

export function useSpeechSynthesisServer(options: UseSpeechSynthesisOptions = {}) {
  const { lang = "es-VE" } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTextRef = useRef<string | null>(null);
  const textLengthRef = useRef(0);
  // Cache de URLs: hash(text) → objectURL. Evita re-pedir al VPS si el
  // usuario vuelve a leer el mismo mensaje.
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsSupported(!!TTS_ENDPOINT && "Audio" in window);
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
      }
      // Liberar object URLs
      for (const url of cacheRef.current.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      cacheRef.current.clear();
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setIsSpeaking(false);
    setIsLoading(false);
    setCurrentText(null);
    setProgress(0);
    setCharIndex(0);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!isSupported || !text) return;
      if (currentTextRef.current === text && audioRef.current) {
        // Same text already loading/playing — toggle off
        stop();
        return;
      }

      // Stop any previous playback
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current = null;
      }

      // Limpia el texto antes de mandarlo a Kokoro: saca emojis y markdown
      // que el TTS leería raro ("carita sonriente", "asterisco", etc.).
      const cleaned = cleanTextForTTS(text);

      currentTextRef.current = text;
      setCurrentText(text);
      setProgress(0);
      setCharIndex(0);
      textLengthRef.current = cleaned.length;
      setError(null);
      setIsLoading(true);

      let url: string;
      try {
        url = await getOrFetchAudio(cleaned, cacheRef.current, setError);
        if (currentTextRef.current !== text) return; // user moved on
      } catch (e: any) {
        setError(e?.message || "Error al generar audio");
        setIsLoading(false);
        setIsSpeaking(false);
        setCurrentText(null);
        return;
      }

      if (currentTextRef.current !== text) return; // raced with stop

      const audio = new Audio(url);
      audio.preload = "auto";
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        setCurrentText(null);
        setProgress(1);
        setCharIndex(0);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        setCurrentText(null);
        setError("No se pudo reproducir el audio");
        setProgress(0);
        setCharIndex(0);
      };
      audio.ontimeupdate = () => {
        if (!audio.duration || !isFinite(audio.duration)) return;
        const p = Math.min(1, audio.currentTime / audio.duration);
        setProgress(p);
        setCharIndex(Math.floor(p * textLengthRef.current));
      };
      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      try {
        await audio.play();
      } catch (e: any) {
        setError("Click para permitir audio del navegador");
        setIsLoading(false);
        setIsSpeaking(false);
      }
    },
    [isSupported, stop]
  );

  return {
    speak, stop,
    isSpeaking, isLoading, currentText, isSupported,
    progress, charIndex, error,
  };
}

async function getOrFetchAudio(
  text: string,
  cache: Map<string, string>,
  setError: (e: string | null) => void
): Promise<string> {
  const key = textHash(text);
  const cached = cache.get(key);
  if (cached) return cached;

  if (!TTS_ENDPOINT) {
    throw new Error("Servidor TTS no configurado");
  }

  const res = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: DEFAULT_VOICE,
      format: "mp3",
      speed: 1.0,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    setError(`TTS error: ${res.status}`);
    throw new Error(`TTS endpoint returned ${res.status}: ${errText.slice(0, 100)}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  // Evict oldest entry if cache grows too big (keep last 10)
  if (cache.size >= 10) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      const oldUrl = cache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      cache.delete(firstKey);
    }
  }
  cache.set(key, url);
  return url;
}

// === cleanTextForTTS ===
// Limpia el texto antes de mandarlo a Kokoro. Sin esto, el TTS intenta
// pronunciar emojis como "carita sonriente", markdown como "asterisco
// asterisco", URLs enteras, etc. El usuario reportó esto.
//
// - Quita emojis (rango Unicode principal + symbols + pictographs)
// - Quita markdown básico (`**negrita**`, `*italic*`, `~~tachado~~`, `## h1`)
// - Quita URLs (http(s)://...)
// - Colapsa espacios múltiples
function cleanTextForTTS(text: string): string {
  return text
    // Quitar URLs
    .replace(/https?:\/\/\S+/g, "")
    // Quitar bloques de código (```...```)
    .replace(/```[\s\S]*?```/g, " bloque de código ")
    // Quitar código inline (`code`)
    .replace(/`([^`]+)`/g, "$1")
    // Quitar bold (**texto**) → texto
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    // Quitar italic (*texto* o _texto_) → texto
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Quitar tachado (~~texto~~) → texto
    .replace(/~~([^~]+)~~/g, "$1")
    // Quitar headers (# titulo) → titulo
    .replace(/^#{1,6}\s*/gm, "")
    // Quitar emojis (rango principal + symbols + pictographs + emoticons)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{1F000}-\u{1F2FF}]/gu, "")
    // Quitar bullets al inicio de linea (- o *)
    .replace(/^\s*[-*+]\s+/gm, "")
    // Colapsar espacios y newlines
    .replace(/\s+/g, " ")
    .trim();
}

function textHash(text: string): string {
  // simple hash, no need for crypto
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return h.toString(36) + "-" + text.length;
}

// === useSpeechRecognitionServer ===
// Reemplaza useSpeechRecognition (Web Speech API) con ElevenLabs Scribe.
// Misma interfaz pública, así ChatInput.tsx no necesita cambios funcionales.
//
// Diferencias vs Web Speech API:
//   - No es streaming: el transcript aparece solo cuando el usuario suelta el
//     botón del mic (es batch, subimos el audio y Scribe devuelve el texto).
//   - Mejor para acento venezolano: Scribe fue entrenado en español LATAM.
//   - Costo: ~$0.30/hora de audio (gratis para uso ligero).
//
// Audio: MediaRecorder graba webm/opus. Chrome, Edge, Firefox y Safari lo
// soportan. El audio va al proxy /api/stt que llama a Scribe (la API key
// nunca sale al browser).

const STT_ENDPOINT = process.env.NEXT_PUBLIC_STT_ENDPOINT || "/api/stt";

export function useSpeechRecognitionServer(options: {
  lang?: VoiceLang;
  onFinalResult?: (text: string) => void;
  onError?: (message: string) => void;
} = {}) {
  const { lang = "es-VE", onFinalResult, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onFinalRef = useRef(onFinalResult);
  const onErrorRef = useRef(onError);
  const streamRef = useRef<MediaStream | null>(null);
  onFinalRef.current = onFinalResult;
  onErrorRef.current = onError;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "MediaRecorder" in window &&
      "mediaDevices" in navigator &&
      !!navigator.mediaDevices?.getUserMedia;
    setIsSupported(supported);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) return;
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setTranscript("");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // webm/opus en Chrome/Edge/Firefox, mp4 en Safari. Scribe acepta ambos.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Stop mic tracks (browser shows red dot otherwise)
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const rawBlob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        if (rawBlob.size < 1000) {
          // Too short, probably accidental click
          setIsListening(false);
          return;
        }
        setIsProcessing(true);
        try {
          // Convert webm/opus from MediaRecorder → WAV 16kHz mono PCM.
          // Most STT services (ElevenLabs Scribe, Deepgram, Whisper) handle
          // WAV much more reliably than webm. Decoding the webm in-browser
          // via AudioContext and re-encoding as standard PCM WAV removes
          // all "container/encoding" mismatches that cause garbage
          // transcriptions.
          const wavBlob = await convertToWav(rawBlob);

          const form = new FormData();
          form.append("audio", wavBlob, "recording.wav");
          form.append("language", lang.split("-")[0] || "es"); // "es-VE" -> "es"

          const res = await fetch(STT_ENDPOINT, { method: "POST", body: form });
          if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            const msg = `STT error: ${res.status}: ${errBody.slice(0, 100)}`;
            setError(msg);
            onErrorRef.current?.(msg);
            return;
          }
          const data = await res.json();
          const text = (data.text || "").trim();
          if (text) {
            setTranscript(text);
            onFinalRef.current?.(text);
          }
        } catch (e: any) {
          const msg = e?.message || "Error al transcribir";
          setError(msg);
          onErrorRef.current?.(msg);
        } finally {
          setIsProcessing(false);
          setIsListening(false);
        }
      };

      recorder.start();
      setIsListening(true);
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Permiso de micrófono denegado"
          : e?.name === "NotFoundError"
          ? "No se encontró micrófono"
          : e?.message || "No se pudo iniciar el micrófono";
      setError(msg);
      onErrorRef.current?.(msg);
      setIsListening(false);
    }
  }, [isSupported, lang]);

  const stop = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") {
      try { r.stop(); } catch {}
    }
    // onstop will set isListening=false after the upload completes
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { mediaRecorderRef.current?.stop(); } catch {}
    };
  }, []);

  return { isListening, isProcessing, transcript, error, isSupported, start, stop, reset };
}

// === Audio conversion: webm/opus → WAV 16kHz mono PCM ===
//
// MediaRecorder produces webm/opus (Chrome) or mp4/aac (Safari). Most
// STT services handle WAV PCM much more reliably than containerized
// formats. This function:
//   1. Decodes the original audio in the browser via Web Audio API
//   2. Resamples to 16kHz mono (the sweet spot for STT services)
//   3. Encodes as 16-bit PCM WAV (RIFF header + raw samples)
async function convertToWav(blob: Blob): Promise<Blob> {
  // Use anyAudioContext to avoid issues in older Safari
  const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new Ctx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (e) {
    // If decoding fails (corrupt or unsupported), fall back to the raw blob
    ctx.close();
    throw new Error("No se pudo decodificar el audio. Intenta de nuevo.");
  }

  const targetSampleRate = 16000;
  const numChannels = 1;

  // Resample + mix to mono using OfflineAudioContext. For 1-channel source
  // this is a straight resample; for stereo it also downmixes.
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  // Encode as 16-bit PCM WAV (RIFF header + samples)
  const numSamples = rendered.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = targetSampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // PCM data — channel 0 only (mono)
  const channel = rendered.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  ctx.close();
  return new Blob([buffer], { type: "audio/wav" });
}
