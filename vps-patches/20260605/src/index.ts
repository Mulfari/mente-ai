import express from "express";
import cors from "cors";
import crypto from "crypto";
import { Orchestrator } from "./orchestrator";
import { embed, EmbedError } from "./embeddings";

const app = express();
const port = parseInt(process.env.PORT || "3000");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const orchestrator = new Orchestrator();

function verifyVPSToken(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = token.split(".");
  // Accept both 2-part (legacy) and 3-part (standard JWT) formats
  if (parts.length !== 2 && parts.length !== 3) return null;
  // For 3-part JWTs: header.payload.signature (standard jose format)
  // For 2-part: legacy format was payload.signature (no header)
  let encoded: string;
  let sig: string;
  if (parts.length === 3) {
    encoded = parts[0] + "." + parts[1];
    sig = parts[2];
  } else {
    encoded = parts[0];
    sig = parts[1];
  }
  const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest();
  // Convert raw bytes to base64url (jose library uses base64url, not hex)
  const expectedSigB64 = expectedSig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  if (sig !== expectedSigB64) return null;
  try {
    // For 3-part, payload is parts[1]; for 2-part it's parts[0]
    const payloadStr = parts.length === 3 ? parts[1] : parts[0];
    const payload = JSON.parse(Buffer.from(payloadStr, "base64").toString("utf8"));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload.userId as string;
  } catch { return null; }
}

// Require token auth for all /api/* routes
function requireToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.VPS_SHARED_SECRET || "";
  const token = (req.body && req.body.token) || (req.headers["x-vps-token"] as string);
  if (!token) return res.status(401).json({ error: "Token requerido" });
  const userId = verifyVPSToken(token, secret);
  if (!userId) return res.status(401).json({ error: "Token invalido o expirado" });
  // Attach verified userId so downstream handlers use it instead of raw body.user_id
  (req as any).vpsUserId = userId;
  next();
}

app.post("/api/orchestrate", requireToken, async (req, res) => {
  const { question, conversation_id, mode, attachments, user_context, conversation_history } = req.body;
  const userId = (req as any).vpsUserId;
  if (!question?.trim()) return res.status(400).json({ error: "Mensaje vacio" });

  try {
    const result = await orchestrator.process({
      question,
      user_id: userId,
      conversation_id,
      mode: mode || "normal",
      attachments,
      user_context,
      conversation_history,
    });
    await orchestrator.saveQA(question, result.response, result.topic, result.city);
    res.json(result);
  } catch (err) {
    console.error("[VeChat] Orchestrator error:", err);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
});

app.post("/api/summarize", async (req, res) => {
  const { conversation_history } = req.body;
  if (!conversation_history?.trim()) {
    return res.json({ summary: "" });
  }

  try {
    const { summary } = await orchestrator.summarize(conversation_history);
    res.json({ summary });
  } catch (err) {
    console.error("[VeChat] Summarize error:", err);
    res.status(500).json({ error: "Error generando resumen" });
  }
});

app.post("/api/feedback", async (req, res) => {
  const { question, response, rating, update } = req.body;
  if (rating === undefined || rating === null) return res.status(400).json({ error: "Rating requerido" });
  try {
    await orchestrator.saveFeedback(question, response, rating === true || rating === "true" || rating === 1, update === true);
    res.json({ success: true });
  } catch (err) {
    console.error("[VeChat] Feedback error:", err);
    res.status(500).json({ error: "Error guardando feedback" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/stream", requireToken, async (req, res) => {
  const body = req.body;
  const { message_id, mode, question, attachments, user_context, conversation_history } = body;
  const userId = (req as any).vpsUserId;

  if (!message_id || !question) {
    return res.status(400).json({ error: "Faltan parametros" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (eventName: string, data: any) => {
    (res as NodeJS.WritableStream).write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as NodeJS.WritableStream).write("");
  };

  console.log("[stream] userId:", userId, "userContext:", user_context || null);

  try {
    // Embed the question once and pass the same vector to all three
    // retrievers. If the embed call fails (Cohere down, key missing, etc.)
    // we pass `null` and the retrievers fall back to pg_trgm / ILIKE.
    // Single embed per request; ~150-300ms added vs. the LLM roundtrip.
    let questionEmbedding: number[] | null = null;
    try {
      questionEmbedding = await embed(question as string, "search_query");
    } catch (e) {
      if (e instanceof EmbedError) {
        console.warn(`[stream] embedding failed, falling back to trigram/ILIKE: ${e.message}`);
      } else {
        console.warn("[stream] embedding failed (unexpected):", e);
      }
    }

    const [similarQA, highRatedFeedback, knowledge] = await Promise.all([
      orchestrator.findSimilarQA(question as string, questionEmbedding),
      orchestrator.findHighRatedFeedback(question as string, questionEmbedding),
      orchestrator.findKnowledge(question as string, questionEmbedding),
    ]);
    const enrichedPrompt = orchestrator.buildEnrichedPrompt(
      question as string, similarQA, highRatedFeedback, knowledge,
      user_context || null,
      (conversation_history as string) || undefined
    );

    const parsedAttachments = attachments || [];

    let isDeep = false;
    let fullText = "";
    let contextDelta: { add_notes?: string } | null = null;

    const result = await orchestrator.streamWithContextDelta(
      enrichedPrompt,
      (mode as string) || "normal",
      parsedAttachments,
      (textChunk, isDeepFlag) => {
        isDeep = isDeepFlag;
        fullText += textChunk;
        sendEvent("chunk", { type: "chunk", text: textChunk, is_deep: isDeep });
      }
    );

    fullText = result.fullText;
    contextDelta = result.context_delta;
    isDeep = result.isDeep;

    const { topic, city } = orchestrator.analyzeContent(question + " " + fullText);

    sendEvent("done", { type: "done", is_deep: isDeep, context_delta: contextDelta });
    res.end();

    // Fire-and-forget — don't make the client wait for the DB write.
    // saveQA auto-embeds the new row, so it's retrievable on the very next
    // turn.
    orchestrator.saveQA(question as string, fullText, topic, city).catch((err) =>
      console.warn("[VeChat] saveQA failed:", err)
    );
  } catch (err: any) {
    console.error("[VeChat] Stream error:", err);
    sendEvent("error", { type: "error", message: err.message || "Error de conexion" });
    res.end();
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log("[VeChat] Orchestrator running on port " + port);
});
