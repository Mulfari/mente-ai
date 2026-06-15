import type { MetadataRoute } from "next";

// Genera /sitemap.xml: la lista de páginas PÚBLICAS que queremos que Google
// indexe. Casi todo VeChat vive detrás del login (privado), así que hoy la
// única página de contenido público es la landing. Cuando creemos páginas de
// contenido (guías, FAQ, etc.) se agregan aquí como nuevas entradas.

const SITE_URL = "https://www.mulfai.com.ve";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
