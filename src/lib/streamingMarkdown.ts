// Estabiliza el markdown que se está revelando DURANTE el streaming para que
// las tablas no parpadeen ni se re-rendericen muchas veces.
//
// Problema: el reveal suave (useSmoothReveal) expone el texto palabra por
// palabra y ReactMarkdown re-parsea en cada frame. Una tabla a medio llegar
// pasa por estados intermedios feos: la fila de cabecera se ve como texto con
// pipes (`| Banco | Tasa |`) hasta que llega la fila separadora (`|---|`), y
// cada fila a medio escribir re-parsea. Resultado: la tabla "se forma" varias
// veces y parpadea (y mientras tanto no se puede ni deslizar en móvil).
//
// Solución: si el texto revelado termina DENTRO de una tabla, se recorta el
// pedazo incompleto:
//   - tabla sin separadora completa todavía  -> se oculta la tabla naciente
//     entera (se muestra solo lo de antes);
//   - tabla ya válida pero con la última fila a medio escribir -> se muestran
//     solo las filas completas.
// Así la tabla aparece de una y crece fila-completa por fila-completa, sin
// estados intermedios. Pensado para llamarse SOLO con texto en streaming; el
// render final usa el contenido completo y no necesita esto.
export function clampStreamingTable(md: string): string {
  if (!md.includes("|")) return md; // sin tablas: nada que hacer (caso común)

  const endsNL = md.endsWith("\n");
  const lines = md.split("\n");
  // Última línea "real" a considerar (si termina en \n, el último elemento es
  // un "" artificial del split).
  const runEnd = endsNL ? lines.length - 2 : lines.length - 1;
  if (runEnd < 0) return md;

  // Inicio de la corrida final de filas de tabla (líneas que empiezan con `|`).
  let runStart = runEnd + 1;
  for (let k = runEnd; k >= 0; k--) {
    if (/^\s*\|/.test(lines[k])) runStart = k;
    else break;
  }
  if (runStart > runEnd) return md; // no termina dentro de una tabla

  // Fila separadora GFM: solo pipes/guiones/dos-puntos/espacios, con `-` y `|`.
  const isSeparator = (l: string) => /^[\s|:-]+$/.test(l) && l.includes("-") && l.includes("|");
  // Si la última línea no termina en \n, está a medio escribir: no cuenta como
  // fila completa.
  const completeRunEnd = endsNL ? runEnd : runEnd - 1;

  let hasSeparator = false;
  for (let k = runStart; k <= completeRunEnd; k++) {
    if (isSeparator(lines[k])) {
      hasSeparator = true;
      break;
    }
  }

  // Tabla aún no válida (sin separadora completa): ocultar la tabla naciente.
  if (!hasSeparator) return lines.slice(0, runStart).join("\n");

  // Tabla válida: mostrar solo filas completas (descartar la fila a medio).
  return lines.slice(0, completeRunEnd + 1).join("\n");
}
