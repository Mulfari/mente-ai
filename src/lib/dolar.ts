// src/lib/dolar.ts
// Fuente ESTRUCTURADA para la tasa del dólar en Venezuela (DolarAPI, gratis y
// sin key). Es la "fuente fija confiable" para la pregunta estrella: trae el
// NÚMERO real (oficial y paralelo) en vez de depender de que una búsqueda web
// pesque un artículo con el dato. Si falla, el route cae a la búsqueda normal.

import type { WebSource } from "@/lib/webSearch";

const DOLAR_API_URL = "https://ve.dolarapi.com/v1/dolares";
const DOLAR_TIMEOUT_MS = 4000;

export type DolarRate = { tipo: string; bs: number; actualizado: string };

type DolarApiItem = {
  fuente?: string;
  nombre?: string;
  promedio?: number | null;
  venta?: number | null;
  compra?: number | null;
  fechaActualizacion?: string;
};

// Trae oficial + paralelo. Devuelve [] si la API falla, expira o no trae
// números válidos — para que el llamador caiga con gracia a la búsqueda web.
export async function fetchDolarRates(): Promise<DolarRate[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOLAR_TIMEOUT_MS);
  try {
    const res = await fetch(DOLAR_API_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DolarApiItem[];
    if (!Array.isArray(data)) return [];
    return data
      .map((d): DolarRate | null => {
        const bs = d.promedio ?? d.venta ?? d.compra ?? null;
        if (typeof bs !== "number" || !Number.isFinite(bs)) return null;
        return {
          tipo: (d.fuente || d.nombre || "dólar").toString().toLowerCase(),
          bs,
          actualizado: d.fechaActualizacion || "",
        };
      })
      .filter((d): d is DolarRate => d !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Formatea las tasas como contexto para el modelo, en el MISMO shape que la
// búsqueda web (una fuente + una síntesis), para no tocar al cliente: el route
// lo devuelve como { sources, answer } y el chat ya sabe inyectarlo.
export function buildDolarContext(rates: DolarRate[]): { sources: WebSource[]; answer: string } {
  const fmt = (n: number) =>
    n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = (t: string) =>
    t === "oficial" ? "oficial (BCV)" : t === "paralelo" ? "paralelo" : t;
  const lines = rates.map((r) => `Dólar ${label(r.tipo)}: Bs. ${fmt(r.bs)} por USD`);

  const latest = rates
    .map((r) => r.actualizado)
    .filter(Boolean)
    .sort()
    .pop();
  const fecha = latest
    ? new Date(latest).toLocaleDateString("es-VE", {
        timeZone: "America/Caracas",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const answer = `Tasas del dólar en Venezuela${fecha ? ` (actualizado el ${fecha})` : ""}: ${lines.join("; ")}.`;
  const sources: WebSource[] = [
    {
      title: "DolarAPI — Tasas del dólar en Venezuela",
      url: "https://ve.dolarapi.com",
      snippet: `${lines.join(". ")}. Datos en vivo (oficial del BCV y paralelo de mercado).`,
    },
  ];
  return { sources, answer };
}
