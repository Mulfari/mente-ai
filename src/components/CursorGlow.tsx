"use client";

import { useEffect, useRef } from "react";

/**
 * BackgroundSpotlight — a soft teal highlight on the *background* that
 * follows the mouse. Renders behind all content (z-index: 0 in front of
 * the body noise, but the chat shell uses z-10+) so the spotlight only
 * brightens the dark canvas, never the cards or text. Hidden on touch
 * devices and for users who prefer reduced motion.
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
        currentX = targetX;
        currentY = targetY;
        initialized = true;
      }
      el.style.opacity = "1";
    };

    const onLeave = () => {
      el.style.opacity = "0";
    };

    const onEnter = () => {
      if (initialized) el.style.opacity = "1";
    };

    const tick = () => {
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
        width: 700,
        height: 700,
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0,
        transition: "opacity 300ms ease",
        background:
          "radial-gradient(circle, rgba(16,163,127,0.18) 0%, rgba(16,163,127,0.10) 25%, rgba(16,163,127,0.05) 50%, transparent 70%)",
        mixBlendMode: "screen",
        willChange: "transform",
      }}
    />
  );
}
