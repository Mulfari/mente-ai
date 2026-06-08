"use client";

import { useEffect, useRef } from "react";

/**
 * CursorGlow — a subtle teal glow that follows the mouse cursor with a
 * smooth lerp. Decoupled from React state: we mutate the DOM directly
 * inside a requestAnimationFrame loop so the parent doesn't re-render
 * 60 times per second. Hidden on touch devices via a CSS media query
 * (see globals.css) — there's no cursor to follow there.
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let targetX = -2000;
    let targetY = -2000;
    let currentX = -2000;
    let currentY = -2000;
    let initialized = false;
    let visible = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!initialized) {
        // Snap to the first known position so we don't render at 0,0.
        currentX = targetX;
        currentY = targetY;
        initialized = true;
      }
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        visible = false;
        el.style.opacity = "0";
      }, 4000);
    };

    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const tick = () => {
      // Lerp toward the target. 0.12 ≈ 80ms half-life — feels alive but
      // not snappy, matching v0 / Linear / Stripe.
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="cursor-glow"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 720,
        height: 720,
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0,
        transition: "opacity 600ms ease",
        background:
          "radial-gradient(circle, rgba(16,163,127,0.45) 0%, rgba(16,163,127,0.18) 25%, rgba(16,163,127,0.06) 55%, transparent 75%)",
        willChange: "transform",
      }}
    />
  );
}
