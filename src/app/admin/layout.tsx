import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = { title: "Admin - VeChat" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="hide-aurora" strategy="beforeInteractive">{`
        document.addEventListener('DOMContentLoaded', function() {
          var style = document.createElement('style');
          style.textContent = 'body::before, body::after { display: none !important; } html, body { overflow: auto !important; height: auto !important; }';
          document.head.appendChild(style);
        });
      `}</Script>
      {children}
    </>
  );
}