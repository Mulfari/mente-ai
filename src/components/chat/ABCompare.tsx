"use client";

import { useEffect, useRef, useState } from "react";
import { VARIANT_B_INSTRUCTION } from "@/lib/abTest";
import { stripContextDelta } from "@/lib/streamingMarkdown";

// A/B de respuestas (aislado, no toca el flujo de envío). Tras la respuesta
// normal (variante A = la de arriba), genera una variante B más concisa y deja
// que el usuario elija. La preferencia se guarda (POST /api/feedback/ab) y
// alimenta el "% de victoria" del admin. v1: B usa el prompt crudo (sin re-
// grounding) — comparamos ESTILO; el contenido factual puede favorecer a A.
export default function ABCompare({ prompt, onDone }: { prompt: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(true);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const tokenRes = await fetch("/api/auth/vps-token", { method: "POST" });
        if (!tokenRes.ok) { if (!cancelled) { setStreaming(false); onDone(); } return; }
        const { token, vpsUrl } = await tokenRes.json();
        const res = await fetch(`${vpsUrl}/api/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            token, message_id: crypto.randomUUID(), conversation_id: "ab", mode: "deep",
            question: prompt + VARIANT_B_INSTRUCTION, attachments: "[]", user_context: "null", conversation_history: "",
          }),
        });
        if (!res.ok || !res.body) { if (!cancelled) { setStreaming(false); onDone(); } return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "", ev = "", dt = "", acc = "";
        const flush = () => {
          if (!ev || !dt) return;
          let data: { type?: string; text?: string };
          try { data = JSON.parse(dt); } catch { ev = ""; dt = ""; return; }
          if (ev === "chunk" && data.type === "chunk") { acc += data.text ?? ""; if (!cancelled) setText(stripContextDelta(acc)); }
          ev = ""; dt = "";
        };
        let r = await reader.read();
        while (!r.done) {
          buffer += decoder.decode(r.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines[lines.length - 1] ?? "";
          for (const line of lines) {
            if (line === "") { flush(); continue; }
            const em = line.match(/^event: (.+)/);
            const dm = line.match(/^data: (.+)/);
            if (em) { flush(); ev = em[1]; } else if (dm) { dt = dm[1]; }
          }
          r = await reader.read();
        }
        flush();
      } catch { /* best-effort */ }
      if (!cancelled) setStreaming(false);
    })();
    return () => { cancelled = true; };
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(chosen: "a" | "b") {
    setPicked(chosen);
    try {
      await fetch("/api/feedback/ab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosen, prompt }),
      });
    } catch { /* best-effort */ }
    setTimeout(onDone, 1500);
  }

  if (picked) {
    return <div className="ab-card ab-thanks">¡Gracias! Tu elección nos ayuda a mejorar las respuestas. 🙌</div>;
  }

  return (
    <div className="ab-card">
      <div className="ab-head">🔬 Probamos otra versión — ¿cuál prefieres?</div>
      <div className="ab-variant">{text || (streaming ? "Generando otra versión…" : "—")}</div>
      <div className="ab-actions">
        <button className="ab-btn" onClick={() => choose("a")} disabled={streaming} title="La respuesta de arriba">
          Prefiero la de arriba
        </button>
        <button className="ab-btn ab-btn--b" onClick={() => choose("b")} disabled={streaming} title="Esta versión más concisa">
          Prefiero esta
        </button>
      </div>
    </div>
  );
}
