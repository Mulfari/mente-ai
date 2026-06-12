import { esES } from "@clerk/localizations";

// La app en el dashboard de Clerk se llama "My Application", y la
// localización usa {{applicationName}} en subtítulos tipo "para continuar
// en {{applicationName}}". Hasta que se renombre en el dashboard (Settings
// → Application name, también afecta los correos), sustituimos el
// placeholder por la marca en TODA la localización de una vez.
const branded = JSON.parse(
  JSON.stringify(esES).replaceAll("{{applicationName}}", "VeChat")
) as typeof esES;

// Hueco de esES: el placeholder del campo de contraseña del registro queda
// en inglés ("Create a password").
(branded as Record<string, unknown>).formFieldInputPlaceholder__password =
  "Crea una contraseña";

export const vechatLocalization = branded;
