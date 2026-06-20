"use client";

import { useState, type CSSProperties } from "react";
import type { MetricsData, NamedCount } from "@/lib/adminStats";

// Dashboard de métricas del admin. Portado del export de Claude Design, con
// hover interactivo en los gráficos (resalta la barra/punto y muestra
// "fecha · valor" en el encabezado). Sin deps. Tokens reales de VeChat.

const INK = "var(--text-primary)";
const INK3 = "var(--text-tertiary)";
const BRAND = "var(--primary)";
const SURFACE = "var(--surface)";
const BORDER = "var(--border)";
const TRACK = "color-mix(in srgb, var(--text-primary) 7%, transparent)";
const DISP = "'Bricolage Grotesque', Inter, sans-serif";

const card: CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 };
const sectionLabel: CSSProperties = { font: "600 11px Inter", letterSpacing: ".08em", textTransform: "uppercase", color: INK3 };
const cardTitle: CSSProperties = { font: `600 14px ${DISP}`, color: INK };
const subStyle: CSSProperties = { font: "500 12px Inter", color: INK3, fontVariantNumeric: "tabular-nums" };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// 30 etiquetas de día (hoy-29 … hoy) en hora de Venezuela, alineadas con los
// buckets del server (mismo desfase UTC-4).
function dayLabels(n: number): string[] {
  const out: string[] = [];
  const nowVE = new Date(Date.now() - 4 * 3600 * 1000);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowVE);
    d.setUTCDate(nowVE.getUTCDate() - i);
    out.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
  }
  return out;
}

function sparkPaths(arr: number[]) {
  const n = arr.length, m = Math.max(1, ...arr), W = 300, H = 100, pad = 14;
  const pts = arr.map((v, i) => ({ x: n === 1 ? W / 2 : (i / (n - 1)) * W, y: H - (v / m) * (H - pad) }));
  const line = "M" + pts.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" L");
  return { line, area: `${line} L${W},${H} L0,${H} Z`, rel: pts.map((p) => ({ x: p.x / W, y: p.y / H })) };
}

function withWidth(items: NamedCount[]) {
  const m = Math.max(1, ...items.map((i) => i.count));
  return items.map((i) => ({ ...i, w: Math.round((i.count / m) * 100) }));
}

function Bars({ values, height, hi, setHi }: { values: number[]; height: number; hi: number | null; setHi: (i: number | null) => void }) {
  const m = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 3, height }} onMouseLeave={() => setHi(null)}>
      {values.map((v, i) => (
        <div key={i} onMouseEnter={() => setHi(i)}
          style={{ flex: 1, display: "flex", alignItems: "flex-end", cursor: "default" }}>
          <div style={{
            width: "100%", height: `${Math.round((v / m) * 100)}%`, minHeight: 3, borderRadius: "3px 3px 0 0",
            background: v > 0 ? BRAND : TRACK, opacity: hi === null || hi === i ? 1 : 0.4, transition: "opacity .12s",
          }} />
        </div>
      ))}
    </div>
  );
}

function Line({ values, height, hi, setHi }: { values: number[]; height: number; hi: number | null; setHi: (i: number | null) => void }) {
  const { line, area, rel } = sparkPaths(values);
  return (
    <div style={{ position: "relative", height }} onMouseLeave={() => setHi(null)}>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <path d={area} fill={BRAND} fillOpacity={0.12} stroke="none" />
        <path d={line} fill="none" stroke={BRAND} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {hi !== null && (
        <div style={{
          position: "absolute", left: `${rel[hi].x * 100}%`, top: `${rel[hi].y * 100}%`,
          width: 9, height: 9, borderRadius: "50%", background: BRAND, border: "2px solid var(--surface)",
          transform: "translate(-50%,-50%)", pointerEvents: "none",
        }} />
      )}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {values.map((_, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} style={{ flex: 1, cursor: "default" }} />
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, defaultSub, values, labels, type, height }: {
  title: string; defaultSub: string; values: number[]; labels: string[]; type: "bars" | "line"; height: number;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const sub = hi !== null ? `${labels[hi]} · ${values[hi]}` : defaultSub;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={cardTitle}>{title}</span>
        <span style={subStyle}>{sub}</span>
      </div>
      {type === "bars"
        ? <Bars values={values} height={height} hi={hi} setHi={setHi} />
        : <Line values={values} height={height} hi={hi} setHi={setHi} />}
    </div>
  );
}

function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TopList({ title, subtitle, items, icon }: { title: string; subtitle?: string; items: NamedCount[]; icon: "map" | "chat" | "target" }) {
  const rows = withWidth(items);
  return (
    <div style={card}>
      {subtitle ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={cardTitle}>{title}</span>
          <span style={{ font: "500 12px Inter", color: INK3 }}>{subtitle}</span>
        </div>
      ) : (
        <span style={cardTitle}>{title}</span>
      )}
      {rows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {rows.map((t, i) => (
            <div key={i} className="mt-row" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ font: "500 13px Inter", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <span style={{ font: "600 12.5px Inter", color: INK }}>{t.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: TRACK }}>
                <div style={{ height: "100%", width: `${t.w}%`, borderRadius: 999, background: BRAND, opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: INK3, font: "500 13px Inter" }}>
          {icon === "map" ? <MapIcon /> : icon === "chat" ? <ChatIcon /> : <TargetIcon />} Sin datos todavía
        </div>
      )}
    </div>
  );
}

export default function MetricsTab({ data }: { data: MetricsData }) {
  const labels = dayLabels(30);
  const planTotal = data.planes.reduce((s, p) => s + p.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .mt-kpi { transition: border-color .12s, transform .12s; }
        .mt-kpi:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); transform: translateY(-1px); }
        .mt-row { margin: 0 -8px; padding: 4px 8px; border-radius: 9px; transition: background .12s; }
        .mt-row:hover { background: color-mix(in srgb, var(--text-primary) 4%, transparent); }
      `}</style>

      <div style={sectionLabel}>Resumen</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
        {data.kpis.map((k, i) => (
          <div key={i} className="mt-kpi" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ font: "600 10.5px Inter", letterSpacing: ".05em", textTransform: "uppercase", color: INK3, lineHeight: 1.3 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
              <span style={{ font: "600 27px Inter", letterSpacing: "-.02em", color: INK, lineHeight: 1 }}>{k.value}</span>
              {k.delta ? <span style={{ font: "600 11px Inter", color: BRAND }}>↑ {k.delta}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Crecimiento</div>
      <ChartCard title="Registros por día" defaultSub="últimos 30 días" values={data.registros} labels={labels} type="bars" height={112} />

      <div style={{ ...sectionLabel, marginTop: 6 }}>Uso</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <ChartCard title="Mensajes por día" defaultSub="últimos 30 días" values={data.mensajes} labels={labels} type="line" height={82} />
        <ChartCard title="Consultas por día" defaultSub="últimos 30 días" values={data.consultas} labels={labels} type="bars" height={82} />
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Negocio · geografía · contenido</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
        <div style={card}>
          <span style={cardTitle}>Usuarios por plan</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {data.planes.map((p, i) => {
              const pct = planTotal ? Math.round((p.count / planTotal) * 100) : 0;
              return (
                <div key={i} className="mt-row" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ font: "500 13px Inter", color: INK }}>{p.name}</span>
                    <span style={{ font: "500 12px Inter", color: INK3 }}>{p.count} · {pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: TRACK, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: BRAND }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <TopList title="Top ciudades" items={data.ciudades} icon="map" />
        <TopList title="Top consultas" items={data.topConsultas} icon="chat" />
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Demanda sin cobertura · a quién reclutar</div>
      <TopList
        title="Lo más pedido que NO tenemos"
        subtitle="Categorías + ciudad que la gente buscó y aún no están en VeLocal (últimos 30 días). Tu lista de a quién sumar."
        items={data.demandaSinCobertura}
        icon="target"
      />
    </div>
  );
}
