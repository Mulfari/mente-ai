"use client";

import React, { useRef } from "react";
import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  user_id?: string;
  conversation_id?: string;
  attachments?: string[];
  _previewUrls?: Record<string, string>;
  _loading?: boolean;
  in_progress?: boolean;
  _retryReq?: { message: string; conversationId: string; contentParts: any[]; mode: string } | null;
  mode?: string;
  _isDeep?: boolean;
  _feedbackGiven?: boolean;
  feedback_vote?: boolean | null;
};

type Props = {
  messages: Message[];
  streamingMsgId: string | null;
  retryMode: string | null;
  formatTime: (date: string) => string;
  // Espacio reservado bajo la última pregunta para que pueda "subir" al tope
  // del viewport (estilo Gemini). Lo controla ChatInterface; se encoge solo a
  // medida que la respuesta llena la pantalla.
  bottomSpacer?: number;
};

export default function MessageList({
  messages,
  streamingMsgId,
  retryMode,
  formatTime,
  bottomSpacer = 0,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex-1 flex flex-col justify-end">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          streamingMsgId={streamingMsgId}
          retryMode={retryMode}
          formatTime={formatTime}
        />
      ))}
      <div aria-hidden style={{ height: bottomSpacer }} />
      <div ref={messagesEndRef} />
    </div>
  );
}
