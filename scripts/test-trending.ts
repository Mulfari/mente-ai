// Verifies the /api/trending contract: no id appears in 2+ sections, all
// items have a numeric eventCount >= 0, and the schema is stable.
//
// Run:    npx tsx scripts/test-trending.ts
// Env:    TEST_BASE_URL      (default: http://localhost:3000)
//         TEST_AUTH_COOKIE   (optional — for the logged-in check)

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const COOKIE = process.env.TEST_AUTH_COOKIE ?? null;

type Item = {
  id: string;
  categoryId: string;
  title: string;
  subtitle: string;
  iconKey: string;
  eventCount: number;
  prompts: string[];
};

type Sections = {
  trending: Item[];
  nearYou: Item[];
  forYou: Item[];
  recent: Item[];
};

type TrendingResponse = {
  sections: Sections;
  meta: { userCity: string | null; topCategory: string | null };
};

let pass = 0;
let fail = 0;
const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  if (ok) pass++;
  else fail++;
}

async function fetchTrending(label: string, cookie: string | null): Promise<TrendingResponse | null> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  try {
    const r = await fetch(`${BASE}/api/trending`, { headers });
    if (!r.ok) {
      check(`${label}: response ok`, false, `HTTP ${r.status}`);
      return null;
    }
    check(`${label}: response ok`, true);
    return (await r.json()) as TrendingResponse;
  } catch (e) {
    check(`${label}: fetch`, false, String(e));
    return null;
  }
}

function assertSchemaShape(label: string, data: unknown): data is TrendingResponse {
  const ok =
    !!data &&
    typeof data === "object" &&
    typeof (data as any).sections === "object" &&
    Array.isArray((data as any).sections?.trending) &&
    Array.isArray((data as any).sections?.nearYou) &&
    Array.isArray((data as any).sections?.forYou) &&
    Array.isArray((data as any).sections?.recent) &&
    typeof (data as any).meta === "object";
  check(`${label}: response shape (sections + meta)`, ok);
  return ok;
}

function assertNoOverlap(label: string, data: TrendingResponse) {
  const counts: Record<string, number> = {};
  for (const section of ["trending", "nearYou", "forYou", "recent"] as const) {
    for (const item of data.sections[section]) {
      counts[item.id] = (counts[item.id] ?? 0) + 1;
    }
  }
  const dups = Object.entries(counts).filter(([, c]) => c > 1);
  if (dups.length === 0) {
    check(`${label}: no duplicate ids across sections`, true);
  } else {
    const detail = dups.map(([id, c]) => `${id}(${c})`).join(", ");
    check(`${label}: no duplicate ids across sections`, false, `duplicates: ${detail}`);
  }
}

function assertEventCountValid(label: string, data: TrendingResponse) {
  let bad = 0;
  for (const section of ["trending", "nearYou", "forYou", "recent"] as const) {
    for (const item of data.sections[section]) {
      if (typeof item.eventCount !== "number" || item.eventCount < 0 || !Number.isFinite(item.eventCount)) {
        bad++;
      }
    }
  }
  if (bad === 0) {
    check(`${label}: all items have valid eventCount`, true);
  } else {
    check(`${label}: all items have valid eventCount`, false, `${bad} items with bad eventCount`);
  }
}

function summarize(label: string, data: TrendingResponse) {
  const sizes = {
    trending: data.sections.trending.length,
    nearYou: data.sections.nearYou.length,
    forYou: data.sections.forYou.length,
    recent: data.sections.recent.length,
  };
  console.log(`\n  ${label} section sizes:`, sizes);
  if (data.meta.userCity) console.log(`  userCity: ${data.meta.userCity}`);
  if (data.meta.topCategory) console.log(`  topCategory: ${data.meta.topCategory}`);
}

async function main() {
  console.log(`\nVeChat /api/trending contract test`);
  console.log(`Base: ${BASE}`);
  console.log(`Auth: ${COOKIE ? "yes" : "no"}\n`);

  const anon = await fetchTrending("anon", null);
  if (anon && assertSchemaShape("anon", anon)) {
    summarize("anon", anon);
    assertNoOverlap("anon", anon);
    assertEventCountValid("anon", anon);
  }

  if (COOKIE) {
    const authed = await fetchTrending("authed", COOKIE);
    if (authed && assertSchemaShape("authed", authed)) {
      summarize("authed", authed);
      assertNoOverlap("authed", authed);
      assertEventCountValid("authed", authed);
    }
  }

  console.log("\nResults:");
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const line = `  ${mark}  ${r.name}`;
    console.log(line + (r.detail && !r.ok ? `  — ${r.detail}` : ""));
  }
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
