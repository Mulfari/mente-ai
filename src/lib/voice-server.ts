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
