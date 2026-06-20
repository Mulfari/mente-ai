"use client";

import type { CSSProperties } from "react";
import type { MetricsData, NamedCount } from "@/lib/adminStats";

// Dashboard de métricas del admin. Portado del export de Claude Design
// (VeChatMetrics.dc.html) a JSX, con los tokens reales de VeChat. Sin deps.

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

function bars(arr: number[]) {
  const m = Math.max(1, ...arr);
  return arr.map((v) => ({ h: Math.round((v / m) * 100), on: v > 0 }));
}
function spark(arr: number[]) {
  const n = arr.length, m = Math.max(1, ...arr), W = 300, H = 100, pad = 14;
  const pts = arr.map((v, i) => {
    const x = n === 1 ? W / 2 : Math.round((i / (n - 1)) * W * 10) / 10;
    const y = Math.round((H - (v / m) * (H - pad)) * 10) / 10;
    return `${x},${y}`;
  });
  const line = "M" + pts.join(" L");
  return { line, area: `${line} L${W},${H} L0,${H} Z` };
}
function withWidth(items: NamedCount[]) {
  const m = Math.max(1, ...items.map((i) => i.count));
  return items.map((i) => ({ ...i, w: Math.round((i.count / m) * 100) }));
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

function TopList({ title, items, icon }: { title: string; items: NamedCount[]; icon: "map" | "chat" }) {
  const rows = withWidth(items);
  return (
    <div style={card}>
      <span style={cardTitle}>{title}</span>
      {rows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {rows.map((t, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          {icon === "map" ? <MapIcon /> : <ChatIcon />} Sin datos todavía
        </div>
      )}
    </div>
  );
}

export default function MetricsTab({ data }: { data: MetricsData }) {
  const reg = bars(data.registros);
  const con = bars(data.consultas);
  const msg = spark(data.mensajes);
  const planTotal = data.planes.reduce((s, p) => s + p.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={sectionLabel}>Resumen</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
        {data.kpis.map((k, i) => (
          <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ font: "600 10.5px Inter", letterSpacing: ".05em", textTransform: "uppercase", color: INK3, lineHeight: 1.3 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
              <span style={{ font: "600 27px Inter", letterSpacing: "-.02em", color: INK, lineHeight: 1 }}>{k.value}</span>
              {k.delta ? <span style={{ font: "600 11px Inter", color: BRAND }}>↑ {k.delta}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Crecimiento</div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={cardTitle}>Registros por día</span>
          <span style={{ font: "500 12px Inter", color: INK3 }}>últimos 30 días</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 112 }}>
          {reg.map((b, i) => (<div key={i} style={{ flex: 1, height: `${b.h}%`, minHeight: 3, borderRadius: "3px 3px 0 0", background: b.on ? BRAND : TRACK }} />))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px Inter", color: INK3 }}><span>hace 30 días</span><span>hoy</span></div>
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Uso</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <span style={cardTitle}>Mensajes por día</span><span style={{ font: "500 12px Inter", color: INK3 }}>30 días</span>
          </div>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: "100%", height: 82, display: "block" }}>
            <path d={msg.area} fill={BRAND} fillOpacity={0.12} stroke="none" />
            <path d={msg.line} fill="none" stroke={BRAND} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <span style={cardTitle}>Consultas por día</span><span style={{ font: "500 12px Inter", color: INK3 }}>30 días</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 82 }}>
            {con.map((b, i) => (<div key={i} style={{ flex: 1, height: `${b.h}%`, minHeight: 3, borderRadius: "3px 3px 0 0", background: b.on ? BRAND : TRACK }} />))}
          </div>
        </div>
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Negocio · geografía · contenido</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
        <div style={card}>
          <span style={cardTitle}>Usuarios por plan</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {data.planes.map((p, i) => {
              const pct = planTotal ? Math.round((p.count / planTotal) * 100) : 0;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
    </div>
  );
}
