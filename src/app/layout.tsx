import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
  title: "Mulfai — Tu asistente de IA personal",
  description: "Chatea con Mulfai, tu asistente inteligente. Conversaciones naturales, respuestas instantaneas, codigo con syntax highlighting.",
  keywords: ["chat AI", "asistente virtual", "IA conversacional", "Mulfai"],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}