import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ViewportHeight from "@/components/ViewportHeight";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  minimumScale: 1.0,
  userScalable: false,
  interactiveWidget: "overlays-content",
};

export const metadata: Metadata = {
  title: "VeChat — Tu asistente de IA personal",
  description: "Chatea con VeChat, tu asistente inteligente. Conversaciones naturales, respuestas instantaneas, codigo con syntax highlighting.",
  keywords: ["chat AI", "asistente virtual", "IA conversacional", "VeChat"],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
  other: {
    "og:title": "VeChat",
    "og:description": "Tu asistente de IA personal",
    "og:site_name": "VeChat",
    "og:type": "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      // Frontend API proxied through our own domain (see src/proxy.ts).
      // Relative URL resolves against the current origin in the browser.
      // clerk-js script source can still be overridden with the
      // NEXT_PUBLIC_CLERK_JS_URL env var (the SDK reads it automatically).
      proxyUrl="/__clerk"
    >
      <html lang="es" className={inter.variable} data-theme="dark" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vechat-theme');if(t)document.documentElement.setAttribute('data-theme',t);else document.documentElement.setAttribute('data-theme','dark');}catch(e){}})()`
          }} />
        </head>
        <body className="antialiased">
          {/* Syncs --vh CSS var to window.visualViewport.height so the chat
              container and input follow the on-screen keyboard without jumping. */}
          <ViewportHeight />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}