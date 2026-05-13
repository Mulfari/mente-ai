import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const KNOWLEDGE_RULES = [
  {
    trigger_type: "keyword",
    trigger_value: "quien eres",
    response: "Soy Mulfai, tu asistente de inteligencia artificial personal. Estoy aquí para ayudarte con preguntas, recomendaciones, y encontrar lugares locales en Venezuela como restaurantes, farmacias, clínicas y más.",
    priority: 100,
  },
  {
    trigger_type: "keyword",
    trigger_value: "que eres",
    response: "Soy Mulfai, tu asistente de inteligencia artificial personal. Estoy aquí para ayudarte con preguntas, recomendaciones, y encontrar lugares locales en Venezuela como restaurantes, farmacias, clínicas y más.",
    priority: 100,
  },
  {
    trigger_type: "keyword",
    trigger_value: "como te llamas",
    response: "Me llamo Mulfai. Soy tu asistente de inteligencia artificial, diseñado para ayudarte en lo que necesites.",
    priority: 100,
  },
  {
    trigger_type: "keyword",
    trigger_value: "que es mulfai",
    response: "Mulfai es tu asistente de inteligencia artificial personal. Puedo responder preguntas, darte recomendaciones de lugares locales en Venezuela y ayudarte en tu día a día.",
    priority: 100,
  },
  {
    trigger_type: "keyword",
    trigger_value: "que puedes hacer",
    response: "Como Mulfai puedo:\n1. Responder tus preguntas sobre diversos temas\n2. Recomendarte lugares locales: restaurantes, farmacias, clínicas, gimnasios y más\n3. Darte información sobre horarios, direcciones y contactos de negocios locales\n4. Ayudarte con cualquier consulta del día a día\n\nSolo escribe tu pregunta y con gusto te ayudo.",
    priority: 95,
  },
  {
    trigger_type: "keyword",
    trigger_value: "para que sirves",
    response: "Soy Mulfai, tu asistente de IA. Puedo ayudarte con:\n- Responder preguntas sobre diversos temas\n- Recomendaciones de restaurantes, farmacias, clínicas y otros lugares en Venezuela\n- Información sobre lugares locales en Maracay, Caracas, Valencia y Barquisimeto\n- Cualquier otra consulta que tengas",
    priority: 90,
  },
  {
    trigger_type: "keyword",
    trigger_value: "como funcionas",
    response: "Funciono gracias a inteligencia artificial avanzada. Puedes escribirme cualquier pregunta o solicitud y haré lo posible por ayudarte. Si me preguntas por lugares locales en Venezuela, puedo mostrarte opciones del directorio de Mulfai.",
    priority: 90,
  },
  {
    trigger_type: "keyword",
    trigger_value: "que pais eres",
    response: "Soy un asistente de inteligencia artificial llamado Mulfai. Estoy diseñado para ayudar a personas en Venezuela, con información local y recomendaciones.",
    priority: 90,
  },
  {
    trigger_type: "keyword",
    trigger_value: "como te uso",
    response: "¡Es muy fácil! Solo escribe tu pregunta o lo que necesites en el chat. Puedo ayudarte desde recomendación de lugares hasta responder cualquier consulta. Si buscas un lugar específico como un restaurante o farmacia, puedo mostrarte opciones del directorio local.",
    priority: 85,
  },
  {
    trigger_type: "keyword",
    trigger_value: "hablas ingles",
    response: "Mi idioma principal es el español. Responderé siempre en español para facilitar la comunicación. Si necesitas ayuda con términos en otros idiomas, con gusto te asisto.",
    priority: 80,
  },
  {
    trigger_type: "keyword",
    trigger_value: "eres venezolano",
    response: "Soy Mulfai, un asistente de inteligencia artificial diseñado para ayudar a usuarios en Venezuela. Estoy aquí para proporcionar información útil y recomendaciones locales.",
    priority: 80,
  },
  {
    trigger_type: "keyword",
    trigger_value: "cuanto cuesta",
    response: "Mulfai es una plataforma con acceso por suscripción. Tu administrador te proporcionará un cupón de acceso. Si no tienes acceso, contacta al administrador para obtener más información.",
    priority: 70,
  },
  {
    trigger_type: "keyword",
    trigger_value: "es gratis",
    response: "El acceso a Mulfai se maneja mediante cupones de suscripción. Contacta al administrador para obtener tu cupón de acceso.",
    priority: 70,
  },
];

function matchRule(userMessage) {
  const msg = userMessage.toLowerCase().trim();
  const sorted = [...KNOWLEDGE_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (rule.trigger_type === "keyword") {
      if (msg.includes(rule.trigger_value.toLowerCase())) {
        return rule;
      }
    }
  }
  return null;
}

const server = new Server(
  {
    name: "mulfai-knowledge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "knowledge_lookup",
        description: "Busca en el conocimiento de Mulfai una respuesta predefinida para la pregunta del usuario. Si hay match, devuelve la respuesta fija. Si no hay match, devuelve null para que se use IA generativa.",
        inputSchema: {
          type: "object",
          properties: {
            user_message: {
              type: "string",
              description: "El mensaje del usuario a evaluar",
            },
          },
          required: ["user_message"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "knowledge_lookup") {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }

  const { user_message } = args;
  const match = matchRule(user_message);

  if (match) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ matched: true, response: match.response }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ matched: false, response: null }),
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);