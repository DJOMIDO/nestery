// scripts/update-travel-data.mjs
// Downloads the airport and airline lists used by Travel and writes compact
// JSON next to the server code. Run with `npm run travel:data`; commit the
// result.
//
// Airports: github.com/mwgg/Airports (MIT, license kept in
// src/server/travel/data/AIRPORTS-LICENSE.txt), only those with an IATA code.
// Airlines: Wikidata (CC0), active airlines with an IATA code. Several
// companies can share a code (subsidiaries, cargo arms); the one with the
// most Wikipedia articles wins.
// Chinese names: Wikidata too, for the Simplified and Traditional interface
// (airports-zh.json, airlines-zh.json); other languages use the English ones.

import { writeFile } from "node:fs/promises";

const OUT = new URL("../src/server/travel/data/", import.meta.url);
const AIRPORTS_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const WIKIDATA_URL = "https://query.wikidata.org/sparql";

async function airports() {
  const res = await fetch(AIRPORTS_URL);
  if (!res.ok) throw new Error(`Airports: ${res.status}`);
  const all = Object.values(await res.json());
  const rows = all
    .filter((a) => /^[A-Z]{3}$/.test(a.iata ?? "") && a.tz)
    // [iata, name, city, country (ISO 2), lat, lon, time zone]
    .map((a) => [a.iata, a.name, a.city || null, a.country, round(a.lat), round(a.lon), a.tz])
    .sort((a, b) => a[0].localeCompare(b[0]));
  // A few codes appear twice; keep the first
  const seen = new Set();
  return rows.filter(([iata]) => !seen.has(iata) && seen.add(iata));
}

const round = (n) => Math.round(n * 10_000) / 10_000;

async function airlines() {
  const query = `
    SELECT ?iata ?name ?links WHERE {
      ?airline wdt:P31/wdt:P279* wd:Q46970; wdt:P229 ?iata; wikibase:sitelinks ?links.
      FILTER NOT EXISTS { ?airline wdt:P576 ?dissolved }
      ?airline rdfs:label ?name. FILTER(LANG(?name) = "en")
    }`;
  const res = await fetch(`${WIKIDATA_URL}?${new URLSearchParams({ query })}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "Nestery travel data (personal project)" },
  });
  if (!res.ok) throw new Error(`Wikidata: ${res.status}`);
  const best = new Map();
  for (const b of (await res.json()).results.bindings) {
    const iata = b.iata.value.toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(iata)) continue;
    const links = Number(b.links.value);
    if (!best.has(iata) || best.get(iata).links < links) best.set(iata, { name: b.name.value, links });
  }
  // [iata, name]
  return [...best].map(([iata, { name }]) => [iata, name]).sort((a, b) => a[0].localeCompare(b[0]));
}

// ---- Chinese names ------------------------------------------------------------

const ZH = ["zh", "zh-hans", "zh-cn", "zh-sg", "zh-my", "zh-hant", "zh-tw", "zh-hk", "zh-mo"];
// Each script's own labels first; plain "zh", then the other script, when
// that is all there is
const SIMPLIFIED = ["zh-cn", "zh-hans", "zh-sg", "zh-my", "zh", "zh-hant", "zh-tw", "zh-hk", "zh-mo"];
const TRADITIONAL = ["zh-tw", "zh-hant", "zh-hk", "zh-mo", "zh", "zh-hans", "zh-cn", "zh-sg", "zh-my"];

// Large queries can run out of Wikidata's minute; they are asked one at a
// time, and again on failure
async function sparql(query) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(WIKIDATA_URL, {
        method: "POST",
        body: new URLSearchParams({ query }),
        headers: { Accept: "application/sparql-results+json", "User-Agent": "Nestery travel data (personal project)" },
      });
      if (!res.ok) throw new Error(`Wikidata: ${res.status}`);
      // A timeout midway leaves the JSON broken
      return JSON.parse(await res.text()).results.bindings;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 10_000 * attempt));
    }
  }
}

const zhOnly = (variable) => `FILTER(LANG(${variable}) IN (${ZH.map((l) => `"${l}"`).join(",")}))`;
const pick = (labels, order) => order.map((lang) => labels?.get(lang)).find(Boolean) ?? null;
// Language -> label, from rows with ?label (or another variable)
const labelsOf = (rows, variable = "label") =>
  new Map(rows.filter((b) => b[variable]).map((b) => [b[variable]["xml:lang"], b[variable].value]));

// Per code, the Wikidata item with the most Wikipedia articles, as for the
// English names
function bestItems(rows, codePattern) {
  const best = new Map();
  for (const b of rows) {
    const code = b.iata.value.toUpperCase();
    const links = Number(b.links.value);
    if (codePattern.test(code) && (!best.has(code) || best.get(code).links < links)) {
      best.set(code, { item: b.item.value, links });
    }
  }
  return best;
}

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

// "上海市" -> "上海"; short names ("沙市") and others ("東京都") stay
const cityName = (name) => (name && name.length > 2 && name.endsWith("市") ? name.slice(0, -1) : name);

// { IATA: [Simplified name, Simplified city, Traditional name, Traditional city] }
async function airportsZh(codes) {
  const names = await sparql(`SELECT ?item ?iata ?links ?label WHERE {
    ?item wdt:P238 ?iata; wikibase:sitelinks ?links; rdfs:label ?label. ${zhOnly("?label")}
  }`);
  // The place each airport serves (P931); kept lean, as it is the largest
  const cities = await sparql(`SELECT ?item ?iata ?city ?label WHERE {
    ?item wdt:P238 ?iata; wdt:P931 ?city. ?city rdfs:label ?label. ${zhOnly("?label")}
  }`);
  const best = bestItems(names, /^[A-Z]{3}$/);
  // Airports without a Chinese name of their own still get their city's
  for (const b of cities) {
    const code = b.iata.value.toUpperCase();
    if (/^[A-Z]{3}$/.test(code) && !best.has(code)) best.set(code, { item: b.item.value, links: 0 });
  }
  const namesByItem = groupBy(names, (b) => b.item.value);
  const citiesByItem = groupBy(cities, (b) => b.item.value);
  const out = {};
  for (const code of codes) {
    const item = best.get(code)?.item;
    if (!item) continue;
    const labels = labelsOf(namesByItem.get(item) ?? []);
    // Several places served: the first
    const served = citiesByItem.get(item) ?? [];
    const city = served.length ? labelsOf(served.filter((b) => b.city.value === served[0].city.value)) : null;
    const row = [
      pick(labels, SIMPLIFIED),
      cityName(pick(city, SIMPLIFIED)),
      pick(labels, TRADITIONAL),
      cityName(pick(city, TRADITIONAL)),
    ];
    if (row.some(Boolean)) out[code] = row;
  }
  return out;
}

// { IATA: [Simplified name, Traditional name, other Chinese names] }; the
// other names ("东航") only help searching
async function airlinesZh(codes) {
  const rows = await sparql(`SELECT ?item ?iata ?links ?label ?alias WHERE {
    ?item wdt:P31/wdt:P279* wd:Q46970; wdt:P229 ?iata; wikibase:sitelinks ?links.
    FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
    { ?item rdfs:label ?label. ${zhOnly("?label")} } UNION { ?item skos:altLabel ?alias. ${zhOnly("?alias")} }
  }`);
  const best = bestItems(rows, /^[A-Z0-9]{2}$/);
  const byItem = groupBy(rows, (b) => b.item.value);
  const out = {};
  for (const code of codes) {
    const item = best.get(code)?.item;
    const found = item ? byItem.get(item) : null;
    if (!found) continue;
    const labels = labelsOf(found);
    const simplified = pick(labels, SIMPLIFIED);
    const traditional = pick(labels, TRADITIONAL);
    const aliases = [...new Set(found.filter((b) => b.alias).map((b) => b.alias.value))].filter(
      (alias) => alias !== simplified && alias !== traditional
    );
    if (simplified || traditional) out[code] = [simplified, traditional, aliases];
  }
  return out;
}

const [airportRows, airlineRows] = await Promise.all([airports(), airlines()]);
const airportZhRows = await airportsZh(airportRows.map(([iata]) => iata));
const airlineZhRows = await airlinesZh(airlineRows.map(([iata]) => iata));
await writeFile(new URL("airports.json", OUT), JSON.stringify(airportRows));
await writeFile(new URL("airlines.json", OUT), JSON.stringify(airlineRows));
await writeFile(new URL("airports-zh.json", OUT), JSON.stringify(airportZhRows));
await writeFile(new URL("airlines-zh.json", OUT), JSON.stringify(airlineZhRows));
console.log(
  `${airportRows.length} airports (${Object.keys(airportZhRows).length} in Chinese), ` +
    `${airlineRows.length} airlines (${Object.keys(airlineZhRows).length} in Chinese)`
);
