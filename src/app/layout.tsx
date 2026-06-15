import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque, Plus_Jakarta_Sans, Archivo } from "next/font/google";
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

// Fuente display SOLO para la landing (titulares): grotesca cálida y con
// carácter, para que la página de venta no se sienta genérica. El chat sigue
// en Inter.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

// Cuerpo de la landing (la skill high-end prohíbe Inter para marketing premium).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-landing",
  display: "swap",
});

// Titulares editoriales de la landing: grotesca de medios, sobria y con carácter.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
  weight: ["500", "600", "700"],
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

// URL canónica del sitio. `metadataBase` hace que las rutas relativas de OG /
// iconos se resuelvan a absolutas (Google y las previews de WhatsApp/Telegram
// las necesitan absolutas).
const SITE_URL = "https://www.mulfai.com.ve";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VeChat — La IA venezolana, la que sabe lo de aquí",
    template: "%s · VeChat",
  },
  description:
    "VeChat es la IA venezolana: te responde con lo de aquí y de ahorita — el dólar de hoy, lo que está pasando en el país y los trámites, en vivo. Y además, lo de siempre: estudio, trabajo y código. Empieza gratis.",
  applicationName: "VeChat",
  keywords: [
    "VeChat",
    "IA venezolana",
    "inteligencia artificial Venezuela",
    "IA hecha en Venezuela",
    "dólar hoy Venezuela",
    "tasa del dólar hoy",
    "chat IA en español",
    "asistente virtual venezolano",
    "ChatGPT venezolano",
    "trámites SAIME",
  ],
  authors: [{ name: "Mulfex" }],
  creator: "Mulfex",
  publisher: "Mulfex",
  category: "technology",
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Sin manifest: el archivo no existe en /public y la referencia generaba
  // un 404 en cada carga (si algún día se quiere PWA, crearlo de verdad).
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: SITE_URL,
    siteName: "VeChat",
    title: "VeChat — La IA venezolana, la que sabe lo de aquí",
    description:
      "Lo que pasa en el país, VeChat lo sabe: el dólar de hoy, los trámites y lo de ahorita, en vivo. La IA venezolana que te resuelve con lo de aquí — y también con lo de siempre (estudio, trabajo, código). Empieza gratis.",
    images: [
      {
        url: "/landing/app-desktop.png",
        width: 1340,
        height: 840,
        alt: "VeChat — la IA venezolana que sabe lo de aquí, en vivo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeChat — La IA venezolana, la que sabe lo de aquí",
    description:
      "La IA venezolana que te responde con lo de ahorita: el dólar de hoy, los trámites y lo que pasa en el país, en vivo. Empieza gratis.",
    images: ["/landing/app-desktop.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={vechatLocalization} appearance={vechatAppearance}>
      <html lang="es" className={`${inter.variable} ${bricolage.variable} ${jakarta.variable} ${archivo.variable}`} suppressHydrationWarning>
        <head>
          {/* Antes del primer paint: aplica el tema (claro/oscuro/sistema), el
              color del marco del navegador móvil (theme-color) y el estado del
              sidebar para que el layout nazca correcto — sin flash de tema,
              sin bandas de otro color alrededor de la barra de URL, sin
              brinco del input. */}
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('vechat-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(p==='light'||p==='dark')?p:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',t==='dark'?'#000000':'#F1ECE3');var s=localStorage.getItem('vechat-sidebar-open');document.documentElement.setAttribute('data-sidebar',s==='false'?'closed':'open');}catch(e){}})()`
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