"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SR = any;

function getSpeechRecognitionCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// === Idioma ===
// "es-VE" por defecto porque el mercado de VeChat es Venezuela. Si el
// navegador no tiene voz es-VE, fallback a es-ES o al primer es-*.
// "auto" deja que el navegador detecte (útil para dictado bilingüe).

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

// === useSpeechRecognition ===
// Web Speech API STT. Reconoce el idioma seleccionado. Continuous + interim
// results para que la transcripción se vea en tiempo real. Si el navegador
// devuelve "no-speech" (silencio largo), re-arranca solo con un backoff
// para que el usuario pueda seguir dictando sin volver a tocar el botón.
// Cuando para con "aborted" (stop manual o remount) NO re-arranca.

type UseSpeechRecognitionOptions = {
  lang?: VoiceLang;
  onFinalResult?: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = "es-VE", onFinalResult, onError } = options;
  const CtorRef = useRef<SR | null>(null);
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef(onFinalResult);
  const onErrorRef = useRef(onError);
  // Para distinguir entre "el usuario paró" vs "silencio automático".
  // Solo re-arrancamos en el segundo caso.
  const userStoppedRef = useRef(false);
  // Backoff para re-arranque tras silencio
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onFinalRef.current = onFinalResult;
  onErrorRef.current = onError;

  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    CtorRef.current = Ctor;
    setIsSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = CtorRef.current;
    if (!Ctor) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    userStoppedRef.current = false;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        const trimmed = final.trim();
        if (trimmed) {
          setFinalText(prev => (prev ? `${prev} ${trimmed}` : trimmed));
          if (onFinalRef.current) onFinalRef.current(trimmed);
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e: any) => {
      const code = e?.error || "unknown";
      // eslint-disable-next-line no-console
      console.warn("[voice] SpeechRecognition error:", code, e);
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Permiso de micrófono denegado"
          : code === "no-speech"
          ? null // silencio, re-arrancamos
          : code === "audio-capture"
          ? "No se encontró micrófono"
          : code === "network"
          ? "Sin conexión al servicio de voz. Reintentá."
          : code === "aborted"
          ? null // intencional
          : `Error de voz (${code})`;
      if (message) {
        setError(message);
        if (onErrorRef.current) onErrorRef.current(message);
      }
      // NO cerramos isListening aquí — el re-arranque se hace en onend
    };

    recognition.onend = () => {
      // Si el usuario NO paró y onerror no dijo "permiso denegado",
      // re-arrancamos solos. Backoff: 200ms, 500ms, 1000ms.
      if (!userStoppedRef.current && recognitionRef.current === recognition) {
        const delay = [200, 500, 1000][Math.min(2, retryCountRef.current++)] || 1000;
        retryTimerRef.current = setTimeout(() => {
          if (!userStoppedRef.current && recognitionRef.current === recognition) {
            try { recognition.start(); } catch {}
          }
        }, delay);
        return;
      }
      setIsListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      retryCountRef.current = 0;
      setFinalText("");
      setInterimText("");
      setError(null);
      setIsListening(true);
    } catch (err) {
      setError("No se pudo iniciar el micrófono");
      setIsListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    const r = recognitionRef.current;
    if (r) {
      try { r.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterimText("");
    setError(null);
  }, []);

  // Refs para el re-arranque automático
  // (declarados arriba para que start los pueda referenciar)

  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const r = recognitionRef.current;
      if (r) {
        try { r.abort(); } catch {}
      }
    };
  }, []);

  const transcript = interimText
    ? finalText
      ? `${finalText} ${interimText}`
      : interimText
    : finalText;

  return { isListening, transcript, error, isSupported, start, stop, reset };
}

// === useSpeechSynthesis ===
// Web Speech API TTS. Una utterance a la vez (cancela la anterior).
// Voz: idioma seleccionado → es-* → default.
// progress (0-1) y currentCharIndex permiten dibujar una barra
// de progreso y resaltar la palabra que se está leyendo (karaoke).

type UseSpeechSynthesisOptions = {
  lang?: VoiceLang;
};

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
  const { lang = "es-VE" } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lengthRef = useRef(0);

  useEffect(() => {
    if (!isSpeechSynthesisAvailable()) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    // Si el idioma es "auto", devolvemos null y dejamos al navegador elegir
    if (lang === "auto") return null;
    const langPrefix = lang.split("-")[0]; // "es" de "es-VE"
    return (
      voices.find(v => v.lang === lang) ||
      voices.find(v => v.lang?.toLowerCase().startsWith(`${langPrefix}-`)) ||
      voices[0]
    );
  }, [lang]);

  const speak = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisAvailable() || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;
      lengthRef.current = text.length;
      setProgress(0);
      setCharIndex(0);
      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentText(text);
      };
      // boundary event: el navegador reporta el índice del carácter que
      // se está pronunciando. Útil para resaltar palabra.
      utterance.onboundary = (ev: SpeechSynthesisEvent) => {
        if (typeof ev.charIndex === "number") {
          setCharIndex(ev.charIndex);
          setProgress(Math.min(1, ev.charIndex / Math.max(1, lengthRef.current)));
        }
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        setProgress(1);
        setCharIndex(0);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        setProgress(0);
        setCharIndex(0);
        utteranceRef.current = null;
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [lang, pickVoice]
  );

  const stop = useCallback(() => {
    if (!isSpeechSynthesisAvailable()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentText(null);
    setProgress(0);
    setCharIndex(0);
    utteranceRef.current = null;
  }, []);

  return { speak, stop, isSpeaking, currentText, isSupported, progress, charIndex };
}
