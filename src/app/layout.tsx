import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { vechatAppearance } from "@/lib/clerkAppearance";
import { vechatLocalization } from "@/lib/clerkLocalization";
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
  // OJO: NO usar viewport-fit: cover — extiende la página por DETRÁS de la
  // barra inferior translúcida del navegador móvil y el contenido/fondo se
  // ve a través de ella como una raya de color al fondo de la pantalla.
};

export const metadata: Metadata = {
  title: "VeChat — Tu asistente de IA personal",
  description: "Chatea con VeChat, tu asistente inteligente. Conversaciones naturales, respuestas instantaneas, codigo con syntax highlighting.",
  keywords: ["chat AI", "asistente virtual", "IA conversacional", "VeChat"],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Sin manifest: el archivo no existe en /public y la referencia generaba
  // un 404 en cada carga (si algún día se quiere PWA, crearlo de verdad).
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
    <ClerkProvider localization={vechatLocalization} appearance={vechatAppearance}>
      <html lang="es" className={inter.variable} suppressHydrationWarning>
        <head>
          {/* Antes del primer paint: aplica el tema (claro/oscuro/sistema), el
              color del marco del navegador móvil (theme-color) y el estado del
              sidebar para que el layout nazca correcto — sin flash de tema,
              sin bandas de otro color alrededor de la barra de URL, sin
              brinco del input. */}
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('vechat-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(p==='light'||p==='dark')?p:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',t==='dark'?'#000000':'#DBE4DF');var s=localStorage.getItem('vechat-sidebar-open');document.documentElement.setAttribute('data-sidebar',s==='false'?'closed':'open');}catch(e){}})()`
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