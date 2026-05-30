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
};

export default function MessageList({
  messages,
  streamingMsgId,
  retryMode,
  formatTime,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          streamingMsgId={streamingMsgId}
          retryMode={retryMode}
          formatTime={formatTime}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
