// scripts/update-rail-logos.mjs
// Downloads train companies' logos for Travel into public/carriers/rail, one
// <id>.svg (or .png) each, with where each came from in CREDITS.json there.
// Wikimedia Commons first, keeping only free files (public domain or CC0).
// Companies whose current logo isn't free there take the copy Wikipedia
// shows on their article: their own logo, under no free licence, used here
// only to name the company. The marks remain the companies' trademarks.
// The files are listed in src/lib/railLogos.json; which names match which
// company is in src/lib/railOperators.ts.
// Run with `npm run travel:logos`; commit the result. Files already here
// from the same source are kept; `--force` downloads everything again.

import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

// Company id -> Commons file, chosen by hand for small sizes
const FILES = {
  // Greater China
  "china-railway": "China Railways.svg",
  mtr: "MTR Shenzhen logo.svg",
  "taiwan-railway": "Taiwan Railway alternate logo.svg",
  // Japan
  "jr-east": "JR logo (east).svg",
  "jr-central": "JR logo (central).svg",
  "jr-west": "JR logo (west).svg",
  "jr-kyushu": "JR logo (kyushu).svg",
  "jr-hokkaido": "JR logo (hokkaido).svg",
  "jr-shikoku": "JR logo (shikoku).svg",
  odakyu: "Odakyu logo with its slogan.svg",
  kintetsu: "Kintetsu Logo full.svg",
  keisei: "Keisei Logo full.svg",
  tobu: "Tobu Logo full.svg",
  meitetsu: "Meitetsu logo.svg",
  nankai: "Nankai logo 2.svg",
  // Korea
  korail: "Korail logo.svg",
  srt: "SRT logo.svg",
  // Europe
  ouigo: "TGV Ouigo 2013 logo.svg",
  ter: "Logo TER.svg",
  "tgv-inoui": "TGV inOui logo RDT.svg",
  eurostar: "Eurostar icon RDT (2023).svg",
  db: "Deutsche Bahn AG-Logo.svg",
  obb: "ÖBB Logo Pflatsch neu.svg",
  sbb: "SBB CFF FFS logo notext.svg",
  trenitalia: "Trenitalia logo RDT.svg",
  italo: "Italo Treno Logo.svg",
  iryo: "Iryo 2021 logo.svg",
  ns: "Nederlandse Spoorwegen logo.svg",
  sncb: "SNCB logo.svg",
  cfl: "Logo CFL Luxembourg (2022).svg",
  sj: "SJ (rail operator) logo.svg",
  vr: "VR logo green.svg",
  vy: "Vy logo.svg",
  dsb: "DSB company logo.svg",
  pkp: "PKP Intercity logo.svg",
  cd: "Ceske drahy-logo.svg",
  regiojet: "Regiojet logo.svg",
  "leo-express": "Leo Express.svg",
  mav: "Logo Hungary MÁV.svg",
  cp: "Logo CP 2.svg",
  westbahn: "Westbahn-Logo-2025.svg",
  flixtrain: "FlixTrain Logo 2020.svg",
  // UK and Ireland
  "irish-rail": "Irish Rail logo.svg",
  "ni-railways": "Logomark NI Railways.svg",
  "national-rail": "National Rail logo.svg",
  lner: "LNER Logo.svg",
  gwr: "Great Western Railway (2015) logo.svg",
  southeastern: "Southeastern logo (2006–2014).svg",
  thameslink: "ThameslinkSymbol.svg",
  tfw: "Transport wales logo18.svg",
  c2c: "C2c logo.svg",
  chiltern: "Logo Chiltern Railways.svg",
  "elizabeth-line": "Elizabeth line roundel.svg",
  "grand-central": "GrandCentral Railway logo.svg",
  "gatwick-express": "Gatwick Express logo.svg",
  merseyrail: "Merseyrail Icon.svg",
  wmr: "West Midlands Railway generic symbol.svg",
  // North America
  amtrak: "Amtrak logo 2.svg",
  via: "VIA Rail Canada simplified.svg",
  brightline: "Brightline text logo.svg",
  "metro-north": "Metro-North logo.svg",
  lirr: "LIRR logo.svg",
  "nj-transit": "NJT NJ Symbol.svg",
  caltrain: "Caltrain roundel.svg",
  metra: "Metra Logo.svg",
  go: "GO Transit logo.svg",
  // Australia and New Zealand
  "sydney-trains": "Syd Trains Logo.svg",
  "queensland-rail": "Queensland Rail logo.svg",
  transperth: "Transperth icon.svg",
  "auckland-transport": "AT Train Pictogram.svg",
};

// Company id -> [Wikipedia language, file]: logos not free on Commons
const WIKIPEDIA = {
  sncf: ["fr", "Logo SNCF (2011).svg"],
  renfe: ["es", "Logotipo de Renfe Operadora (2026).svg"],
  oncf: ["fr", "Logo ONCF.svg"],
  "al-boraq": ["en", "Logo for Al Boraq.png"],
  scotrail: ["en", "ScotRail logo.svg"],
  avanti: ["en", "Avanti West Coast Logo.svg"],
  "hull-trains": ["en", "HullTrainsLogo.svg"],
  emr: ["en", "East Midlands Railway logo.svg"],
  lnr: ["en", "London Northwestern Railway full logo.svg"],
  southern: ["en", "Southern toc logo.png"],
  "nsw-trainlink": ["en", "NSW TrainLink logo.svg"],
  vline: ["en", "VLine logo (2014).svg"],
  "metro-melbourne": ["en", "Metro Trains Melbourne Logo.svg"],
  "adelaide-metro": ["en", "Adelaide Metro logo.svg"],
  kiwirail: ["en", "KiwiRail logo.svg"],
  metlink: ["en", "Metlink-brand.svg"],
};

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const wikipedia = (lang) => `https://${lang}.wikipedia.org/w/api.php`;
// Wikimedia asks tools to name themselves, and limits fast requests
const HEADERS = { "User-Agent": "Nestery travel logos (https://github.com/DJOMIDO/nestery)" };
const OUT = new URL("../public/carriers/rail/", import.meta.url);
const LIST = new URL("../src/lib/railLogos.json", import.meta.url);
const FREE = /^(Public domain|CC0)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status !== 429) return res;
    await sleep(Math.min(Number(res.headers.get("retry-after")) || 10, 30) * 1000 * (attempt + 1));
  }
  throw new Error(`${url}: rate limited`);
}

// The files' addresses, licences and authors on a wiki, 50 per request
async function fileInfo(api, titles) {
  const info = {};
  for (let i = 0; i < titles.length; i += 50) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      titles: titles.slice(i, i + 50).map((t) => `File:${t}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|extmetadata",
    });
    const data = await (await get(`${api}?${params}`)).json();
    // Titles come back normalised (e.g. underscores); map them back
    const back = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(data.query.pages)) {
      const meta = page.imageinfo?.[0]?.extmetadata ?? {};
      info[(back.get(page.title) ?? page.title).replace(/^File:/, "")] = page.imageinfo && {
        url: page.imageinfo[0].url,
        page: page.imageinfo[0].descriptionurl,
        license: meta.LicenseShortName?.value ?? "",
        nonFree: !!meta.NonFree?.value,
        artist: (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim(),
      };
    }
  }
  return info;
}

// What to download: [id, file info, whether it must be free]
const sources = [];
const commons = await fileInfo(COMMONS, Object.values(FILES));
for (const [id, title] of Object.entries(FILES)) sources.push([id, title, commons[title], true]);
for (const lang of new Set(Object.values(WIKIPEDIA).map(([l]) => l))) {
  const entries = Object.entries(WIKIPEDIA).filter(([, [l]]) => l === lang);
  const found = await fileInfo(wikipedia(lang), entries.map(([, [, title]]) => title));
  for (const [id, [, title]] of entries) sources.push([id, title, found[title], false]);
}

await mkdir(OUT, { recursive: true });
const force = process.argv.includes("--force");
const previous = force ? {} : JSON.parse(await readFile(new URL("CREDITS.json", OUT), "utf8").catch(() => "{}"));
const previousFiles = force ? {} : JSON.parse(await readFile(LIST, "utf8").catch(() => "{}"));
const exists = (name) =>
  access(new URL(name, OUT)).then(
    () => true,
    () => false
  );

const credits = {};
const files = {};
let downloaded = 0;
for (const [id, title, file, mustBeFree] of sources) {
  // Already here from the same file: keep it
  const kept = previousFiles[id];
  if (previous[id]?.file === title && kept && (await exists(kept))) {
    files[id] = kept;
    credits[id] = previous[id];
    continue;
  }
  if (!file) {
    console.warn(`${id}: ${title} not found`);
    continue;
  }
  if (mustBeFree && (file.nonFree || !FREE.test(file.license))) {
    console.warn(`${id}: ${title} is ${file.license || "unlicensed"}, skipped`);
    continue;
  }
  const extension = file.url.split("?")[0].split(".").pop().toLowerCase();
  if (extension !== "svg" && extension !== "png") {
    console.warn(`${id}: ${title} is not an SVG or PNG, skipped`);
    continue;
  }
  await sleep(1000);
  const body = Buffer.from(await (await get(file.url)).arrayBuffer());
  // Shown with <img>, where scripts never run; refuse them anyway
  const svg = extension === "svg" && body.toString("utf8");
  const valid = svg
    ? svg.includes("<svg") && !/<script|\son\w+=/i.test(svg)
    : body.subarray(1, 4).toString("ascii") === "PNG";
  if (!valid) {
    console.warn(`${id}: ${title} is not a plain image, skipped`);
    continue;
  }
  // A company's earlier file may have had the other extension
  if (kept && kept !== `${id}.${extension}`) await rm(new URL(kept, OUT), { force: true });
  files[id] = `${id}.${extension}`;
  await writeFile(new URL(files[id], OUT), body);
  downloaded++;
  credits[id] = {
    file: title,
    source: file.page,
    license: mustBeFree ? file.license : "Not free: the company's own logo, as shown on Wikipedia",
    author: file.artist || null,
  };
}

// Files of companies no longer listed
const listed = new Set([...Object.values(files), "CREDITS.json"]);
for (const name of await readdir(OUT)) {
  if (!listed.has(name)) await rm(new URL(name, OUT));
}

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL("CREDITS.json", OUT), JSON.stringify(sorted(credits), null, 2) + "\n");
await writeFile(LIST, JSON.stringify(sorted(files), null, 2) + "\n");
console.log(`${Object.keys(files).length} of ${sources.length} train company logos (${downloaded} downloaded)`);
