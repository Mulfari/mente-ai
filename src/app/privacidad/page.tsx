import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidad — VeChat",
  description: "Cómo VeChat recoge, usa y protege tus datos.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" updated="20 de junio de 2026">
      <p>
        En <strong>VeChat</strong> (operado por <strong>Mulfex</strong>) cuidamos tus datos. Esta
        política explica qué recogemos, para qué lo usamos y con quién lo compartimos. Al usar VeChat
        aceptas lo aquí descrito junto con nuestros <a href="/terminos">Términos de servicio</a>.
      </p>

      <h2>1. Qué datos recogemos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> tu correo y tu nombre, a través de nuestro proveedor de autenticación.</li>
        <li><strong>Tus conversaciones:</strong> las preguntas y respuestas de tu chat (tu historial).</li>
        <li><strong>Tu contexto:</strong> ciudad e intereses, ya sea los que tú indicas o los que se infieren de tu uso para personalizar el servicio.</li>
        <li><strong>Ubicación:</strong> solo si la autorizas en tu navegador, para mostrarte negocios cercanos.</li>
        <li><strong>Uso y datos técnicos:</strong> las consultas que haces (para tendencias y personalización) y datos como tu dirección IP, que usamos para estimar tu ciudad de forma aproximada.</li>
      </ul>

      <h2>2. Para qué usamos tus datos</h2>
      <ul>
        <li>prestar el servicio y generar las respuestas del chat;</li>
        <li>personalizar tu experiencia (el feed, tu contexto, el descubrimiento de negocios cercanos);</li>
        <li>mejorar VeChat y entender cómo se usa de forma agregada;</li>
        <li>dar soporte y prevenir fraude o abuso.</li>
      </ul>

      <h2>3. Proveedores que nos ayudan</h2>
      <p>
        Para operar VeChat compartimos los datos necesarios con proveedores que los procesan por
        nuestra cuenta: el servicio de <strong>autenticación</strong> (registro e inicio de sesión),
        la <strong>base de datos</strong> y el <strong>alojamiento</strong>, y el{" "}
        <strong>proveedor del modelo de IA</strong>, al que se envían tus mensajes para generar las
        respuestas. También usamos servicios para traer datos en vivo (por ejemplo, la tasa del dólar
        o búsquedas en la web) cuando tu pregunta lo requiere.
      </p>

      <h2>4. No vendemos tus datos</h2>
      <p>
        No vendemos tu información personal ni la compartimos con terceros para su propio marketing.
        Solo la compartimos con los proveedores indispensables para que VeChat funcione, o cuando la
        ley nos lo exija.
      </p>

      <h2>5. Ubicación</h2>
      <p>
        Tu navegador te pide permiso antes de compartir tu ubicación. La usamos en el momento para
        ordenar los negocios por cercanía. Puedes negar o revocar ese permiso cuando quieras desde tu
        navegador.
      </p>

      <h2>6. Cookies y almacenamiento</h2>
      <p>
        Usamos cookies de sesión para mantenerte conectado y almacenamiento local del navegador para
        recordar tus preferencias (como el tema claro u oscuro). No usamos cookies de publicidad de
        terceros.
      </p>

      <h2>7. Cuánto tiempo guardamos tus datos</h2>
      <p>
        Conservamos tus datos mientras tengas una cuenta activa. Si <strong>cierras tu cuenta</strong>,
        eliminamos tu perfil, tus conversaciones y tu contexto.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, corregirlos, eliminarlos y cerrar tu cuenta, así como pedirnos una
        copia de tu información. Para ejercer cualquiera de estos derechos, escríbenos (ver Contacto).
      </p>

      <h2>9. Menores de edad</h2>
      <p>
        VeChat no está dirigido a menores de edad. Si crees que un menor nos ha proporcionado datos
        sin la debida autorización, contáctanos y los eliminaremos.
      </p>

      <h2>10. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger tus datos. Ningún sistema es 100 % seguro, pero
        trabajamos para reducir los riesgos.
      </p>

      <h2>11. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política. La versión vigente estará siempre en esta página con su
        fecha; si el cambio es importante, te avisaremos en la app.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Para cualquier consulta sobre tu privacidad escríbenos por <strong>WhatsApp</strong> o a{" "}
        <a href="mailto:contacto@mulfai.com.ve">contacto@mulfai.com.ve</a>.
      </p>
    </LegalPage>
  );
}
