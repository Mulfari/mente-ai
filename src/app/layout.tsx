import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { vechatAppearance } from "@/lib/clerkAppearance";
import "./globals.css";
import ViewportHeight from "@/components/ViewportHeight";
import ThemeWatcher from "@/components/ThemeWatcher";

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
    <ClerkProvider localization={esES} appearance={vechatAppearance}>
      <html lang="es" className={inter.variable} suppressHydrationWarning>
        <head>
          {/* Antes del primer paint: aplica el tema (claro/oscuro/sistema) y
              el estado del sidebar (abierto/cerrado) para que el layout nazca
              con el ancho correcto — sin flash de tema ni brinco del input. */}
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('vechat-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(p==='light'||p==='dark')?p:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);var s=localStorage.getItem('vechat-sidebar-open');document.documentElement.setAttribute('data-sidebar',s==='false'?'closed':'open');}catch(e){}})()`
          }} />
        </head>
        <body className="antialiased">
          {/* Syncs --vh CSS var to window.visualViewport.height so the chat
              container and input follow the on-screen keyboard without jumping. */}
          <ViewportHeight />
          {/* Sigue los cambios de tema del sistema cuando la preferencia es "system" */}
          <ThemeWatcher />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}