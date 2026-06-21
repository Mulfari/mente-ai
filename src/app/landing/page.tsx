import Landing from "@/components/landing/Landing";
import { getAppConfig } from "@/lib/appConfig";

// Página de venta (la landing). Antes vivía en `/`; ahora `/` es el chat directo
// (Bloque 1 embudo) y la landing queda aquí para SEO/campañas.
export default async function LandingPage() {
  const appConfig = await getAppConfig();
  return <Landing appConfig={appConfig} />;
}
