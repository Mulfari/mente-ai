import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Términos de servicio — VeChat",
  description: "Términos de servicio de VeChat, la IA venezolana.",
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de servicio" updated="20 de junio de 2026">
      <p>
        Estos términos rigen tu uso de <strong>VeChat</strong>, un asistente de inteligencia
        artificial para Venezuela operado por <strong>Mulfex</strong> (“nosotros”). Al usar VeChat
        aceptas estos términos y nuestra <a href="/privacidad">Política de privacidad</a>. Si no
        estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. Qué es VeChat</h2>
      <p>
        VeChat es un chat de IA que responde preguntas, ayuda con tareas y te ayuda a descubrir
        información y negocios locales de Venezuela (por ejemplo, la tasa del dólar, trámites o
        lugares cerca de ti). Es una herramienta de información y asistencia, no un proveedor de
        servicios profesionales.
      </p>

      <h2>2. Quién puede usarlo</h2>
      <p>
        Debes ser mayor de edad (18 años) o usar VeChat con la autorización y supervisión de tu
        representante legal. Al registrarte declaras que la información que das es veraz.
      </p>

      <h2>3. Tu cuenta</h2>
      <p>
        El registro y el inicio de sesión se manejan a través de nuestro proveedor de autenticación.
        Eres responsable de la seguridad de tu cuenta y de la actividad que ocurra en ella. Avísanos
        si detectas un uso no autorizado.
      </p>

      <h2>4. Naturaleza de la IA (importante)</h2>
      <p>
        Las respuestas de VeChat las genera un modelo de inteligencia artificial y{" "}
        <strong>pueden ser imprecisas, incompletas o estar desactualizadas</strong>. VeChat{" "}
        <strong>no brinda asesoría profesional</strong> (legal, médica, financiera, fiscal ni de
        ningún otro tipo). Verifica por tu cuenta cualquier información importante antes de actuar.
        Las decisiones que tomes con base en las respuestas son tu responsabilidad.
      </p>

      <h2>5. Información local y de terceros</h2>
      <p>
        Datos como negocios cercanos, tasas de cambio, trámites o resultados de búsqueda provienen de
        terceros o de fuentes públicas. No garantizamos su exactitud, vigencia ni disponibilidad, y
        no respaldamos a los negocios que aparezcan. Confirma siempre con la fuente o el negocio.
      </p>

      <h2>6. Uso aceptable</h2>
      <p>Al usar VeChat te comprometes a NO:</p>
      <ul>
        <li>usarlo para fines ilegales, fraudulentos o dañinos, ni para acosar o difamar a terceros;</li>
        <li>generar o difundir contenido que viole derechos de otros o la ley;</li>
        <li>intentar vulnerar, dañar, automatizar, “scrapear” o sobrecargar el servicio;</li>
        <li>suplantar a otra persona o eludir los límites de uso.</li>
      </ul>

      <h2>7. Tu contenido</h2>
      <p>
        Conservas tus derechos sobre lo que escribes en VeChat. Nos otorgas una licencia limitada
        para procesar tus mensajes con el fin de prestarte el servicio, lo que incluye enviarlos al
        proveedor del modelo de IA para generar las respuestas (ver la{" "}
        <a href="/privacidad">Política de privacidad</a>).
      </p>

      <h2>8. Planes y pagos</h2>
      <p>
        VeChat ofrece un nivel <strong>gratuito</strong> con un límite diario de mensajes y planes de
        <strong> pago</strong> con uso ampliado. Hoy la activación de los planes de pago es manual
        (por cupón o por WhatsApp). Los precios y límites pueden cambiar; lo informaremos en la app.
        Salvo que la ley exija lo contrario, los pagos no son reembolsables.
      </p>

      <h2>9. Propiedad intelectual</h2>
      <p>
        VeChat, su marca, diseño y software son propiedad de Mulfex. No los copies, modifiques ni uses
        sin nuestro permiso por escrito.
      </p>

      <h2>10. Suspensión y cierre</h2>
      <p>
        Podemos suspender o cerrar cuentas que incumplan estos términos o abusen del servicio. Puedes
        cerrar tu cuenta cuando quieras desde la app; al hacerlo se eliminan tus datos según la
        Política de privacidad.
      </p>

      <h2>11. Servicio “tal cual” y responsabilidad</h2>
      <p>
        VeChat se ofrece <strong>“tal cual”</strong>, sin garantías de ningún tipo. En la medida que
        la ley lo permita, no seremos responsables por daños indirectos ni por decisiones que tomes
        con base en las respuestas del servicio.
      </p>

      <h2>12. Cambios a estos términos</h2>
      <p>
        Podemos actualizar estos términos. La versión vigente estará siempre en esta página con su
        fecha de actualización; si el cambio es importante, te avisaremos en la app.
      </p>

      <h2>13. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Para cualquier
        consulta escríbenos por <strong>WhatsApp</strong> o a{" "}
        <a href="mailto:contacto@mulfai.com.ve">contacto@mulfai.com.ve</a>.
      </p>
    </LegalPage>
  );
}
