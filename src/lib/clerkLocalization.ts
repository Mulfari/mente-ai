import { esES } from "@clerk/localizations";

// La app en el dashboard de Clerk se llama "My Application", y la
// localización usa {{applicationName}} en subtítulos tipo "para continuar
// en {{applicationName}}". Hasta que se renombre en el dashboard (Settings
// → Application name, también afecta los correos), sustituimos el
// placeholder por la marca en TODA la localización de una vez.
const branded = JSON.parse(
  JSON.stringify(esES).replaceAll("{{applicationName}}", "VeChat")
) as typeof esES;

// Hueco de esES: el placeholder del password del REGISTRO no existe en la
// localización (clave formFieldInputPlaceholder__signUpPassword) y queda el
// default en inglés "Create a password".
(branded as Record<string, unknown>).formFieldInputPlaceholder__signUpPassword =
  "Crea una contraseña";

export const vechatLocalization = branded;
