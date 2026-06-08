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

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!initialized) {
        // Snap to the first known position so we don't render at 0,0.
        currentX = targetX;
        currentY = targetY;
        initialized = true;
        el.style.opacity = "1";
      }
    };

    const onLeave = () => {
      el.style.opacity = "0";
    };

    const onEnter = () => {
      if (initialized) el.style.opacity = "1";
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
    document.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
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
        width: 800,
        height: 800,
        pointerEvents: "none",
        zIndex: 50,
        opacity: 0,
        transition: "opacity 600ms ease",
        background:
          "radial-gradient(circle, rgba(16,163,127,0.65) 0%, rgba(16,163,127,0.30) 20%, rgba(16,163,127,0.12) 45%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}
