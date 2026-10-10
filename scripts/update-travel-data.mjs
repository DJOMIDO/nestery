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

const [airportRows, airlineRows] = await Promise.all([airports(), airlines()]);
await writeFile(new URL("airports.json", OUT), JSON.stringify(airportRows));
await writeFile(new URL("airlines.json", OUT), JSON.stringify(airlineRows));
console.log(`${airportRows.length} airports, ${airlineRows.length} airlines`);
