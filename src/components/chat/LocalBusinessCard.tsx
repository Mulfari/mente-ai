import type { LocalBusiness } from "@/lib/localBusinesses";
import { waLink } from "@/lib/phone";

// Tarjeta de un negocio de VeLocal, mostrada dentro de una respuesta del chat
// cuando la pregunta es de descubrimiento local. Solo enlaces (sin estado), así
// que es segura en el bundle del cliente. Ver spec VeLocal-en-VeChat.
export default function LocalBusinessCard({ b }: { b: LocalBusiness }) {
  const wa = waLink(b.whatsapp);
  const profile = `https://velocal.vercel.app/${b.slug}`;
  return (
    <div className="lb-card">
      {b.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="lb-logo" src={b.logoUrl} alt="" loading="lazy" />
      ) : (
        <div className="lb-logo lb-logo--ph" aria-hidden="true">
          {(b.name || "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="lb-body">
        <div className="lb-top">
          <span className="lb-name">{b.name}</span>
          {b.openNow && <span className="lb-open">Abierto</span>}
        </div>
        {(b.category || b.neighborhood || b.distanceKm != null) && (
          <div className="lb-cat">
            {[b.category, b.neighborhood].filter(Boolean).join(" · ")}
            {b.distanceKm != null
              ? `${b.category || b.neighborhood ? " · " : ""}${b.distanceKm.toFixed(b.distanceKm < 10 ? 1 : 0)} km`
              : ""}
          </div>
        )}
        <div className="lb-actions">
          <a className="lb-btn lb-btn--profile" href={profile} target="_blank" rel="noopener noreferrer">
            Ver perfil
          </a>
          {wa && (
            <a className="lb-btn lb-btn--wa" href={wa} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          )}
          {b.mapsUrl && (
            <a className="lb-btn" href={b.mapsUrl} target="_blank" rel="noopener noreferrer">
              Cómo llegar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
