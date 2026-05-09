import { NextResponse } from "next/server";

// Pool diversificado de sugerencias por categoría
const POOL = {
  creativity: [
    "Escribe un poema sobre el mar",
    "Crea una historia corta de ciencia ficción",
    "Dame ideas para un nombre de empresa",
    "Inventame una receta de comida fusión",
    "Escribe una canción sobre el amanecer",
    "Crea un juego de adivinanzas",
    "Dame 5 ideas para historias virales en redes sociales",
    "Escribe un haiku sobre la lluvia",
    "Dame ideas para un podcast",
    "Crea un acróstico con mi nombre",
  ],
  learning: [
    "Explícame blockchain como si tuviera 5 años",
    "Cuáles son los errores más comunes al invertir",
    "Resumen de la historia de Venezuela",
    "Explícame el cambio climático de forma simple",
    "Cuáles son los principios de la economía básica",
    "Dame un resumen de las teorías de liderazgo",
    "Explica la fotosíntesis de manera sencilla",
    "Cuáles son los países más visitados del mundo",
    "Resumen del funcionamiento de las redes sociales",
    "Explica la diferencia entre religions del mundo",
  ],
  productivity: [
    "Crea un plan de estudio para aprender inglés en 3 meses",
    "Dame una rutina diaria para ser más productivo",
    "Ayúdame a organizar mis metas para este año",
    "Cómo puedo mejorar mi concentración",
    "Dame una lista de hábitos matinaux para adoptar",
    "Cómo hacer una buena gestión del tiempo",
    "Escríbeme un cronograma para un proyecto personal",
    "Dame técnicas para memorizar información",
    "Cómo crear un presupuesto mensual simple",
    "Dame ideas para mejorar mi CV",
  ],
  life: [
    "Dame consejos para mejorar la autoestima",
    "Cómo manejar el estrés en el trabajo",
    "Qué preguntas debería hacerme antes de tomar decisiones importantes",
    "Dame ideas para开心的周末",
    "Cómo mejorar la comunicación en pareja",
    "Dame 10 formas de ser más feliz",
    "Cómo dejar de procrastinar",
    "Qué hacer cuando no sabes qué hacer con tu vida",
    "Dame consejos para una entrevista de trabajo exitosa",
    "Cómo mantener una alimentación saludable",
  ],
};

function getDaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let cur = result.length;
  let s = seed;
  while (cur > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const i = Math.floor((s / 0x7fffffff) * cur);
    cur--;
    [result[cur], result[i]] = [result[i], result[cur]];
  }
  return result;
}

export async function GET() {
  const seed = getDaySeed();
  const categories = Object.keys(POOL) as (keyof typeof POOL)[];

  const selected: string[] = [];
  for (const cat of categories) {
    const shuffled = shuffle(POOL[cat], seed + categories.indexOf(cat));
    selected.push(shuffled[0]);
  }

  return NextResponse.json({ suggestions: selected });
}
