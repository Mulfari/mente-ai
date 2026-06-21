import type { LocalBusiness } from "@/lib/localBusinesses";
import { waLink } from "@/lib/phone";
import { categoryGlyph, formatDistanceKm } from "@/lib/businessVisual";
import BizIcon from "@/components/chat/BizIcon";

// Tarjeta de un negocio de VeLocal dentro de una respuesta del chat. Solo enlaces
// (sin estado) → segura en el cliente. Logo = ícono por categoría (sin "logo
// gris"), WhatsApp como acción principal (el canal en VE). Ver spec Bloque 2.
export default function LocalBusinessCard({ b }: { b: LocalBusiness }) {
  const wa = waLink(b.whatsapp);
  const profile = `https://velocal.vercel.app/${b.slug}`;
  const glyph = categoryGlyph(b.category);
  const meta = [
    b.category,
    b.neighborhood,
    b.distanceKm != null ? formatDistanceKm(b.distanceKm) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const tags = (b.tags ?? []).slice(0, 3);

  return (
    <div className="lb-card">
      <div className="lb-head">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lb-logo" src={b.logoUrl} alt="" loading="lazy" />
        ) : (
          <div className="lb-logo lb-logo--glyph" style={{ background: glyph.color }} aria-hidden="true">
            <BizIcon name={glyph.icon} size={24} />
          </div>
        )}
        <div className="lb-body">
          <div className="lb-top">
            <span className="lb-name">{b.name}</span>
            <span className={b.openNow ? "lb-status lb-open" : "lb-status lb-closed"}>
              <span className="lb-dot" aria-hidden="true" />
              {b.openNow ? "Abierto ahora" : "Cerrado"}
            </span>
          </div>
          {meta && <div className="lb-cat">{meta}</div>}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="lb-tags">
          {tags.map((t) => (
            <span key={t} className="lb-tag">{t}</span>
          ))}
        </div>
      )}

      <div className="lb-actions">
        {wa && (
          <a className="lb-btn lb-btn--wa" href={wa} target="_blank" rel="noopener noreferrer">
            <BizIcon name="whatsapp" size={18} />
            WhatsApp
          </a>
        )}
        <div className="lb-actions-row">
          <a className="lb-btn lb-btn--sec" href={profile} target="_blank" rel="noopener noreferrer">
            <BizIcon name="arrow" size={15} />
            Ver perfil
          </a>
          {b.mapsUrl && (
            <a className="lb-btn lb-btn--sec" href={b.mapsUrl} target="_blank" rel="noopener noreferrer">
              <BizIcon name="pin" size={15} />
              Cómo llegar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
