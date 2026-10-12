// scripts/update-carrier-logos.mjs
// Downloads airline symbols for Travel from github.com/soaring-symbols
// (MIT; the airlines' marks remain their trademarks) into public/carriers,
// one <IATA>.svg each, and lists the codes in src/lib/carrierLogos.json.
// Run with `npm run travel:logos`; commit the result.

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

const RAW = "https://raw.githubusercontent.com/soaring-symbols/soaring-symbols/main";
const OUT = new URL("../public/carriers/", import.meta.url);
const LIST = new URL("../src/lib/carrierLogos.json", import.meta.url);

const get = async (path) => {
  const res = await fetch(`${RAW}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.text();
};

const airlines = JSON.parse(await get("airlines.json"));
// Replace the airline files only; train logos live in rail/
await mkdir(OUT, { recursive: true });
for (const name of await readdir(OUT)) {
  if (/\.(svg|txt)$/.test(name)) await rm(new URL(name, OUT));
}

const codes = [];
for (const { iata, slug } of airlines) {
  if (!/^[A-Z0-9]{2}$/.test(iata ?? "")) continue;
  // The symbol alone (often the tail's), which reads at small sizes
  const svg = await get(`assets/${slug}/icon.svg`);
  // Shown with <img>, where scripts never run; refuse them anyway
  if (!svg || /<script|\son\w+=/i.test(svg)) continue;
  await writeFile(new URL(`${iata}.svg`, OUT), svg);
  codes.push(iata);
}
await writeFile(new URL("LICENSE.txt", OUT), await get("LICENSE"));
await writeFile(LIST, JSON.stringify(codes.sort()) + "\n");
console.log(`${codes.length} airline symbols`);
