"use client";

import React from "react";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  conv: Conversation;
  isActive: boolean;
  dateLabel: string;
  onSelect: () => void;
  onDelete: () => void;
};

export default function SwipeableConversation({ conv, isActive, dateLabel, onSelect, onDelete }: Props) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const stateRef = React.useRef({ startX: 0, startY: 0, isDragging: false, currentX: 0, confirming: false, gone: false });
  const DELETE_THRESHOLD = 72;
  const MAX_SWIPE = 160;

  function setSwipe(x: number) {
    const s = stateRef.current;
    s.currentX = x;
    const row = rowRef.current;
    if (row) row.style.transform = `translateX(-${x}px)`;
    const bg = bgRef.current;
    if (bg) {
      const revealW = Math.max(x, 0);
      bg.style.width = `${revealW + 32}px`;
      bg.style.opacity = x > 0 ? "1" : "0";
      const past = x >= DELETE_THRESHOLD;
      bg.style.background = past
        ? "linear-gradient(90deg, #B91C1C 0%, #DC2626 100%)"
        : "linear-gradient(90deg, #7F1D1D 0%, #DC2626 100%)";
      const bar = bg.querySelector<HTMLDivElement>(".swipe-bar");
      if (bar) bar.style.width = `${Math.min(x / DELETE_THRESHOLD, 1) * 100}%`;
      const iconWrap = bg.querySelector<HTMLDivElement>(".swipe-icon");
      if (iconWrap) {
        iconWrap.style.backgroundColor = past ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)";
        iconWrap.style.width = past ? "36px" : "30px";
        iconWrap.style.height = past ? "36px" : "30px";
        iconWrap.style.boxShadow = past ? "0 0 12px rgba(255,255,255,0.3)" : "none";
      }
      const svg = bg.querySelector<SVGElement>(".swipe-svg");
      if (svg) {
        svg.style.width = past ? "16px" : "14px";
        svg.style.height = past ? "16px" : "14px";
        svg.style.filter = past ? "drop-shadow(0 0 4px rgba(255,255,255,0.5))" : "none";
        svg.innerHTML = past
          ? '<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>'
          : '<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>';
      }
      const label = bg.querySelector<HTMLSpanElement>(".swipe-label");
      if (label) {
        const progress = Math.min(x / DELETE_THRESHOLD, 1);
        label.textContent = past ? "Eliminar" : `Desliza +${Math.round(progress * 100)}%`;
      }
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const s = stateRef.current;
    if (s.confirming || s.gone) return;
    const t = e.touches[0];
    s.startX = t.clientX;
    s.startY = t.clientY;
    s.isDragging = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const s = stateRef.current;
    if (!s.isDragging || s.confirming || s.gone) return;
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - s.startY);
    if (dy > 10 && dy > Math.abs(s.startX - t.clientX)) return;
    const dx = s.startX - t.clientX;
    const raw = Math.min(Math.max(dx, 0), MAX_SWIPE);
    const clamped = Math.min(raw, DELETE_THRESHOLD + 12);
    setSwipe(clamped);
  }

  function handleTouchEnd() {
    const s = stateRef.current;
    if (!s.isDragging || s.confirming || s.gone) return;
    s.isDragging = false;
    if (s.currentX >= DELETE_THRESHOLD - 4) {
      s.confirming = true;
      setSwipe(DELETE_THRESHOLD + 12);
      setTimeout(() => {
        s.gone = true;
        const row = rowRef.current;
        if (row) row.style.transition = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-in";
        if (row) row.style.transform = "translateX(-120%)";
        if (row) row.style.opacity = "0";
        setTimeout(() => onDelete(), 350);
      }, 180);
    } else {
      const row = rowRef.current;
      if (row) row.style.transition = "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)";
      setSwipe(0);
      setTimeout(() => {
        if (row) row.style.transition = "";
      }, 400);
    }
  }

  function handleClick() {
    const s = stateRef.current;
    if (s.currentX > 8 || s.confirming || s.gone) { setSwipe(0); return; }
    onSelect();
  }

  if (stateRef.current.gone) return null;

  return (
    <div className="relative mb-0.5" style={{ height: 52, overflow: "hidden" }}>
      {/* Delete background */}
      <div
        ref={bgRef}
        className="absolute inset-y-0 right-0 overflow-hidden rounded-xl pointer-events-none"
        style={{ width: 32, opacity: 0, willChange: "width, opacity" }}
      >
        <div
          className="h-full flex flex-col items-end justify-center rounded-r-xl"
          style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, #7F1D1D 0%, #DC2626 100%)" }}
        >
          <div className="flex items-center gap-2 pr-3">
            <span className="swipe-label text-xs font-semibold" style={{ color: "white", whiteSpace: "nowrap" }}>Desliza +0%</span>
            <div className="swipe-icon flex items-center justify-center rounded-full shrink-0"
              style={{ width: 30, height: 30, backgroundColor: "rgba(255,255,255,0.12)", transition: "all 0.15s" }}>
              <svg className="swipe-svg text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                style={{ width: 14, height: 14 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, overflow: "hidden" }}>
            <div className="swipe-bar" style={{ height: "100%", width: "0%", background: "rgba(255,255,255,0.35)", willChange: "width" }} />
          </div>
        </div>
      </div>

      {/* Main row */}
      <div
        ref={rowRef}
        className="relative flex items-center gap-3 px-4 cursor-pointer select-none rounded-xl"
        style={{
          height: 52,
          backgroundColor: "transparent",
          willChange: "transform",
          WebkitTapHighlightColor: "transparent",
          touchAction: "pan-y",
          zIndex: 1,
          transition: "",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onMouseEnter={e => {
          if (!stateRef.current.isDragging && stateRef.current.currentX === 0) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--surface-hover)";
          }
        }}
        onMouseLeave={e => {
          if (!stateRef.current.isDragging && stateRef.current.currentX === 0) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
          }
          if (!stateRef.current.isDragging && stateRef.current.currentX > 0) setSwipe(0);
        }}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="flex-1 text-sm font-medium truncate" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
          {conv.title}
        </p>
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{dateLabel}</span>
      </div>
    </div>
  );
}
