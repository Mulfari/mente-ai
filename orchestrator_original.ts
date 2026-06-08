import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export class Orchestrator {
  private db: Pool;
  constructor() {
    this.db = new Pool({ connectionString: process.env.DATABASE_URL || "" });
  }

  async process(req: {
    question: string;
    user_id: string;
    conversation_id?: string;
    mode: string;
    attachments?: any[];
    user_context?: { name: string; city: string; interests: string; notes: string } | null;
    conversation_history?: string;
  }): Promise<{ response: any; topic: any; city: any; similar_count: any; knowledge_count: any; feedback_count: any; context_delta: any }> {
    const { question, mode, attachments, user_context, conversation_history } = req;
    const similarQA = await this.findSimilarQA(question);
    const highRatedFeedback = await this.findHighRatedFeedback(question);
    const knowledge = await this.findKnowledge(question);
    return { response: null as any, topic: null as any, city: null as any, similar_count: similarQA.length, knowledge_count: knowledge.length, feedback_count: highRatedFeedback.length, context_delta: null as any };
  }

  async findSimilarQA(question: string, limit = 5) {
        try {
            const result = await this.db.query("SELECT question, answer FROM qa_pairs WHERE similarity(question, $1) > 0.1 ORDER BY similarity(question, $1) DESC LIMIT $2", [question, limit]);
            return result.rows;
        }
        catch {
            return [];
        }
    }

  async findHighRatedFeedback(question: string, limit = 3) {
        try {
            const result = await this.db.query("SELECT question, response FROM response_feedback WHERE rating = true AND similarity(question, $1) > 0.2 ORDER BY similarity(question, $1) DESC LIMIT $2", [question, limit]);
            return result.rows;
        }
        catch {
            return [];
        }
    }

  async findKnowledge(question: string, limit = 10) {
        try {
            const words = question.split(" ").slice(0, 3).join("%");
            const result = await this.db.query("SELECT category, title, content FROM knowledge WHERE content ILIKE ($1) OR title ILIKE ($1) ORDER BY created_at DESC LIMIT $2", ["%" + words + "%", limit]);
            return result.rows;
        }
        catch {
            return [];
        }
    }

  async summarize(conversation_history: string) {
        if (!conversation_history?.trim()) {
            return { summary: "" };
        }
        const systemPrompt = `Eres un asistente que resume conversaciones de chat de forma breve y concisa.
Tu tarea es crear un resumen que capture:
1. El tema general de la conversaciÃƒÂ³n
2. InformaciÃƒÂ³n relevante del usuario (nombre, ciudad, vehÃƒÂ­culo, trabajo, etc.)
3. Las decisiones o preferencias mencionadas
4. El estado actual de la conversaciÃƒÂ³n

El resumen debe:
- Estar en espaÃƒÂ±ol
- Ser de mÃƒÂ¡ximo 3-4 oraciones
- Usar un formato claro con bullets si hay varios puntos
- NO incluir respuestas largas, solo la informaciÃƒÂ³n clave de contexto

Ejemplo de formato:
---
Esta conversaciÃƒÂ³n trata sobre bÃƒÂºsqueda de repuestos para auto.
El usuario vive en Maracay y tiene un Corolla 2015 automÃƒÂ¡tico.
EstÃƒÂ¡ interesado en suspensiÃƒÂ³n y baterÃƒÂ­as.
ÃƒÅ¡ltimo tema discutido: precios de amortiguadores.
---`;
        const body = {
            model: process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4-7",
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: "user", content: [{ type: "text", text: "Resume esta conversaciÃƒÂ³n:\n\n" + conversation_history }] }],
        };
        const apiKey = process.env.ANTHROPIC_API_KEY || "";
        const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
        const res = await fetch(baseUrl + "/v1/messages", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": apiKey,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error("SELECTAPI summarize error: " + res.status);
        const data = await res.json();
        let summary = "";
        if (data.content && Array.isArray(data.content)) {
            for (const block of data.content) {
                if (block.type === "text" && block.text) {
                    summary = block.text.trim();
                    break;
                }
            }
        }
        return { summary };
    }
  buildEnrichedPrompt(
    question: string,
    similarQA: any[],
    highRatedFeedback: any[],
    knowledge: any[],
    userContext?: { name: string; city: string; interests: string; notes: string } | null,
    conversationHistory?: string
  ) {
    const BUDGET = {
      userContext: Infinity,        // never truncate
      conversationHistory: 8000,    // ~2000 tokens
      knowledge: 2000,             // ~500 tokens
      similarQA: 2500,              // ~625 tokens
      feedback: 1500,              // ~375 tokens
    };

    let context = "";
    const add = (text: string) => { context += text; };

    // 1. USER CONTEXT (unlimited)
    if (userContext && (userContext.name || userContext.city || userContext.interests || userContext.notes)) {
      let ctx = "\n\n## Contexto personal del usuario:\n";
      if (userContext.name)     ctx += `- Nombre: ${userContext.name}\n`;
      if (userContext.city)     ctx += `- Ciudad: ${userContext.city}\n`;
      if (userContext.interests) ctx += `- Intereses: ${userContext.interests}\n`;
      if (userContext.notes)    ctx += `- Notas: ${userContext.notes}\n`;
      add(ctx);
    }

    // 2. CONVERSATION HISTORY (budget: 8000)
    if (conversationHistory) {
      const trimmed = conversationHistory.length > BUDGET.conversationHistory
        ? "...\n[historial truncado por limite de tamano]\n" + conversationHistory.slice(-BUDGET.conversationHistory)
        : conversationHistory;
      add("\n\n## Conversacion anterior:\n" + trimmed + "\n");
    }

    // 3. POSITIVE FEEDBACK (budget: 1500)
    if (highRatedFeedback.length > 0) {
      let fbText = "\n\n## Respuestas previamente evaluadas positivamente:\n";
      for (const fb of highRatedFeedback) {
        const entry = "- P: " + fb.question + "\n  R: " + fb.response + "\n";
        if (fbText.length + entry.length > BUDGET.feedback + context.length) break;
        fbText += entry;
      }
      if (fbText !== "\n\n## Respuestas previamente evaluadas positivamente:\n") add(fbText);
    }

    // 4. SIMILAR Q&A PAIRS (budget: 2500)
    if (similarQA.length > 0) {
      let qaText = "\n\n## Conversaciones similares:\n";
      for (const qa of similarQA) {
        const entry = "- P: " + qa.question + "\n  R: " + qa.answer + "\n";
        if (qaText.length + entry.length > BUDGET.similarQA + context.length) break;
        qaText += entry;
      }
      if (qaText !== "\n\n## Conversaciones similares:\n") add(qaText);
    }

    // 5. KNOWLEDGE RULES (budget: 2000)
    if (knowledge.length > 0) {
      let kbText = "\n\n## Informacion de conocimiento:\n";
      for (const k of knowledge) {
        const entry = "- [" + k.category + "] " + k.title + ": " + k.content + "\n";
        if (kbText.length + entry.length > BUDGET.knowledge + context.length) break;
        kbText += entry;
      }
      if (kbText !== "\n\n## Informacion de conocimiento:\n") add(kbText);
    }

    const baseInstruction = `Eres VeChat, un asistente de IA util y conversacional para venezolanos.
RESPONDER EN ESPANOL: Siempre en espanol completo. Nunca mezcles palabras en otros idiomas (ingles, portugues, chino, arabe, etc.). Si un termino tecnico existe en espanol, usalo. No traduzcas a menos que el usuario lo pida.
TONO Y PERSONALIDAD: Hablas como alguien de confianza, tranquilo, directo. No suenas como una enciclopedia ni como un chatbot. Usas expresiones naturales. Das respuestas cortas cuando la pregunta es simple y largas cuando lo merece.
CONOCIMIENTO VENEZUELA: Conoces bien Venezuela — ciudades, economia, cultura, comida, transporte, vida diaria. Si no sabes algo, lo dices claro.
REGLA DE SEGURIDAD: No des instrucciones para nada ilegal en Venezuela.`;

    const contextDeltaInstruction = `
ADICIONAL: Despues de dar tu respuesta, SI el mensaje del usuario contiene informacion personal nueva, devuelvela en este formato JSON EXACTO (sin texto adicional, solo el JSON):
{
  "context_delta": {
    "add_notes": "informacion nueva sobre el usuario que no estaba en su perfil"
  }
}
Solo incluye el JSON si el usuario menciono algo nuevo (vehiculo, trabajo, ciudad, preferencia, situacion familiar, etc.). Si no hay informacion nueva, no incluyas nada.`;

    const totalTokens = Math.ceil((baseInstruction + context + contextDeltaInstruction).length / 4);
    console.log(`[prompt] total chars=${baseInstruction.length + context.length + contextDeltaInstruction.length} estimated_tokens=${totalTokens}`);

    return {
      system: baseInstruction + context + contextDeltaInstruction,
      question,
    };
  }

  async callSELECTAPI(prompt: { system: string; question: string }, mode: string, attachments?: any[]) {
    const { response } = await this.callSELECTAPIWithContextDelta(prompt, mode, attachments);
    return response;
  }

  async callSELECTAPIWithContextDelta(prompt: { system: string; question: string }, mode: string, attachments?: any[]) {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
    const model = process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4-7";
    const body: any = { model, max_tokens: 8192, system: prompt.system };

    const content: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === "image" && att.source) {
          content.push({ type: "image", source: att.source });
        }
      }
    }
    content.push({ type: "text", text: prompt.question });

    body.messages = [{ role: "user", content }];

    if (mode === "deep") body.thinking = { type: "enabled", budget_tokens: 1024 };

    const res = await fetch(baseUrl + "/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("SELECTAPI error: " + res.status + " - " + await res.text());
    const data = await res.json();
    let text = "";
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text" && block.text) {
          text = block.text;
          break;
        }
      }
    }

    let context_delta: { add_notes?: string } | null = null;
    const deltaMatch = text.match(/\{[\s\S]*?"context_delta"[\s\S]*?\}/);
    if (deltaMatch) {
      try {
        const parsed = JSON.parse(deltaMatch[0]);
        if (parsed.context_delta?.add_notes?.trim()) {
          context_delta = { add_notes: parsed.context_delta.add_notes.trim() };
          text = text.replace(deltaMatch[0], "").trim();
          text = text.replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch {
        // JSON parse failed, ignore context_delta
      }
    }

    return { response: text, context_delta };
  }

  async streamWithContextDelta(
    prompt: { system: string; question: string },
    mode: string,
    attachments?: any[],
    onChunk?: (text: string, isDeep: boolean) => void
  ): Promise<{ fullText: string; context_delta: { add_notes?: string } | null; isDeep: boolean }> {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
    const model = process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4-7";
    const body: any = {
      model,
      max_tokens: 8192,
      system: prompt.system,
      stream: true,
    };

    const content: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === "image" && att.source) {
          content.push({ type: "image", source: att.source });
        }
      }
    }
    content.push({ type: "text", text: prompt.question });
    body.messages = [{ role: "user", content }];

    if (mode === "deep") body.thinking = { type: "enabled", budget_tokens: 1024 };

    const res = await fetch(baseUrl + "/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error("SELECTAPI error: " + res.status + " - " + errBody);
    }
    if (!res.body) throw new Error("No response body");

    let fullText = "";
    let isDeep = false;
    let contextDelta: { add_notes?: string } | null = null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines[lines.length - 1] ?? "";

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta") {
            const textChunk = event.delta.text || "";
            if (textChunk) {
              fullText += textChunk;
              if (onChunk) onChunk(textChunk, isDeep);
            }
          }
        } catch {}
      }
    }

    const deltaMatch = fullText.match(/\{[\s\S]*?"context_delta"[\s\S]*?\}/);
    if (deltaMatch) {
      try {
        const parsed = JSON.parse(deltaMatch[0]);
        if (parsed.context_delta?.add_notes?.trim()) {
          contextDelta = { add_notes: parsed.context_delta.add_notes.trim() };
          fullText = fullText.replace(deltaMatch[0], "").trim();
          fullText = fullText.replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch {}
    }

    return { fullText, context_delta: contextDelta, isDeep };
  }

  analyzeContent(text: string) {
    const cities = ["caracas", "maracay", "valencia", "barquisimeto", "maracaibo"];
    const topics = ["clima", "economia", "politica", "deportes", "tecnologia", "salud"];
    let city: string | null = null;
    let topic: string | null = null;
    const lower = text.toLowerCase();
    for (const c of cities) { if (lower.includes(c)) { city = c; break; } }
    for (const t of topics) { if (lower.includes(t)) { topic = t; break; } }
    return { city, topic };
  }

  async saveQA(question: string, answer: string, topic: string | null, city: string | null) {
    try {
      await this.db.query("INSERT INTO qa_pairs (question, answer, topic, city) VALUES ($1, $2, $3, $4)", [question, answer, topic, city]);
    } catch (err) {
      console.warn("[VeChat] Could not save QA:", err);
    }
  }

  async saveFeedback(question: string, response: string, rating: boolean, update = false) {
    try {
      if (update) {
        await this.db.query(
          "UPDATE response_feedback SET rating = $1, created_at = CURRENT_TIMESTAMP WHERE question = $2 AND response = $3",
          [rating, question, response]
        );
      } else {
        await this.db.query(
          "INSERT INTO response_feedback (question, response, rating) VALUES ($1, $2, $3)",
          [question, response, rating]
        );
      }
    } catch (err) {
      console.warn("[VeChat] Could not save feedback:", err);
    }
  }
}