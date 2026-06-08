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

// === useSpeechRecognition ===
// Web Speech API STT. Spanish by default, interim results on so the UI can
// show what is being heard in real time. Final results fire onFinalResult
// so the consumer can append them to the input.

type UseSpeechRecognitionOptions = {
  lang?: string;
  onFinalResult?: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = "es-ES", onFinalResult, onError } = options;
  const CtorRef = useRef<SR | null>(null);
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef(onFinalResult);
  const onErrorRef = useRef(onError);
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
      // Log to console so DevTools shows the raw code for debugging
      // (network / service-not-allowed / aborted are the common
      // non-obvious ones — they usually mean the STT backend is
      // unreachable from this network, not a code bug).
      // eslint-disable-next-line no-console
      console.warn("[voice] SpeechRecognition error:", code, e);
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Permiso de micrófono denegado"
          : code === "no-speech"
          ? "No se detectó voz"
          : code === "audio-capture"
          ? "No se encontró micrófono"
          : code === "network"
          ? "Sin conexión al servicio de voz. Reintentá."
          : code === "aborted"
          ? "" // silent — happens on manual stop or remount
          : `Error de voz (${code})`;
      if (message) {
        setError(message);
        if (onErrorRef.current) onErrorRef.current(message);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
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

  useEffect(() => {
    return () => {
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
// Web Speech API TTS. One utterance at a time. Spanish voice preferred
// (es-ES → es-* → default). Voices are loaded asynchronously on some
// browsers, so we listen for the voiceschanged event.

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
    return (
      voices.find(v => v.lang === "es-ES") ||
      voices.find(v => v.lang?.toLowerCase().startsWith("es-")) ||
      voices[0]
    );
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisAvailable() || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentText(text);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        utteranceRef.current = null;
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [pickVoice]
  );

  const stop = useCallback(() => {
    if (!isSpeechSynthesisAvailable()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentText(null);
    utteranceRef.current = null;
  }, []);

  return { speak, stop, isSpeaking, currentText, isSupported };
}
