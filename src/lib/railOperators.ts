// src/lib/railOperators.ts
// Train companies with a logo (public/carriers/rail, from
// scripts/update-rail-logos.mjs), and the names people write for them. The
// company is typed freely in a journey, so a name matches when it equals
// one of these, ignoring case, accents, spaces and punctuation.

// Company id -> its file
import logos from "@/lib/railLogos.json";

const NAMES: Record<string, string[]> = {
  // Greater China
  "china-railway": ["China Railway", "China Railways", "CR", "中国铁路", "中國鐵路", "中国国家铁路", "国铁", "國鐵", "中铁", "12306"],
  mtr: ["MTR", "港铁", "港鐵", "香港铁路", "香港鐵路"],
  "taiwan-railway": ["Taiwan Railway", "Taiwan Railways", "TRA", "TR", "台铁", "台鐵", "臺鐵", "台湾铁路", "台灣鐵路", "臺灣鐵路"],
  // Japan
  "jr-east": ["JR East", "JR东日本", "JR東日本", "東日本旅客鉄道"],
  "jr-central": ["JR Central", "JR东海", "JR東海", "東海旅客鉄道"],
  "jr-west": ["JR West", "JR西日本", "西日本旅客鉄道"],
  "jr-kyushu": ["JR Kyushu", "JR九州", "九州旅客鉄道"],
  "jr-hokkaido": ["JR Hokkaido", "JR北海道", "北海道旅客鉄道"],
  "jr-shikoku": ["JR Shikoku", "JR四国", "JR四國", "四国旅客鉄道"],
  odakyu: ["Odakyu", "小田急", "小田急電鉄"],
  kintetsu: ["Kintetsu", "近鉄", "近铁", "近畿日本鉄道"],
  keisei: ["Keisei", "京成", "京成電鉄", "京成电铁"],
  tobu: ["Tobu", "東武", "东武", "東武鉄道"],
  meitetsu: ["Meitetsu", "名鉄", "名铁", "名古屋鉄道"],
  nankai: ["Nankai", "南海", "南海電鉄"],
  // Korea
  korail: ["Korail", "KTX", "코레일", "韩国铁路", "韓國鐵路"],
  srt: ["SRT", "SR", "에스알"],
  // Europe
  sncf: ["SNCF", "SNCF Voyageurs", "Intercités", "法国国铁", "法國國鐵"],
  ter: [
    "TER",
    "TER SNCF",
    "Transport express régional",
    "TER Auvergne-Rhône-Alpes",
    "TER Bourgogne-Franche-Comté",
    "TER Bretagne",
    "TER Centre-Val de Loire",
    "TER Grand Est",
    "TER Hauts-de-France",
    "TER Normandie",
    "TER Nouvelle-Aquitaine",
    "TER Occitanie",
    "TER Pays de la Loire",
    "TER Sud",
  ],
  renfe: ["Renfe", "AVE", "Avlo", "Alvia", "Cercanías", "西班牙国铁", "西班牙國鐵"],
  ouigo: ["OUIGO"],
  "tgv-inoui": ["TGV", "TGV INOUI", "INOUI"],
  eurostar: ["Eurostar", "Thalys", "欧洲之星", "歐洲之星"],
  db: ["DB", "Deutsche Bahn", "DB Fernverkehr", "DB Regio", "ICE", "德铁", "德鐵", "德国铁路", "德國鐵路"],
  obb: ["ÖBB", "OEBB", "Nightjet", "奥铁"],
  sbb: ["SBB", "CFF", "FFS", "SBB CFF FFS", "瑞士联邦铁路", "瑞铁"],
  trenitalia: ["Trenitalia", "Frecciarossa", "意大利国铁"],
  italo: ["Italo", "NTV"],
  iryo: ["iryo"],
  ns: ["NS", "Nederlandse Spoorwegen"],
  sncb: ["SNCB", "NMBS", "SNCB/NMBS", "NMBS/SNCB"],
  cfl: ["CFL"],
  sj: ["SJ"],
  vr: ["VR"],
  vy: ["Vy", "NSB"],
  dsb: ["DSB"],
  pkp: ["PKP Intercity", "PKP IC", "PKP"],
  cd: ["ČD", "České dráhy"],
  regiojet: ["RegioJet"],
  "leo-express": ["Leo Express"],
  mav: ["MÁV", "MÁV-START"],
  cp: ["CP", "Comboios de Portugal"],
  westbahn: ["Westbahn"],
  flixtrain: ["FlixTrain"],
  // UK and Ireland
  "irish-rail": ["Irish Rail", "Iarnród Éireann"],
  "ni-railways": ["NI Railways", "Translink"],
  "national-rail": ["National Rail"],
  scotrail: ["ScotRail"],
  avanti: ["Avanti West Coast", "Avanti"],
  "hull-trains": ["Hull Trains"],
  emr: ["East Midlands Railway", "EMR"],
  lnr: ["London Northwestern Railway", "LNR"],
  southern: ["Southern"],
  lner: ["LNER", "London North Eastern Railway"],
  gwr: ["GWR", "Great Western Railway"],
  southeastern: ["Southeastern"],
  thameslink: ["Thameslink"],
  tfw: ["TfW", "TfW Rail", "Transport for Wales"],
  c2c: ["c2c"],
  chiltern: ["Chiltern", "Chiltern Railways"],
  "elizabeth-line": ["Elizabeth line", "TfL"],
  "grand-central": ["Grand Central"],
  "gatwick-express": ["Gatwick Express"],
  merseyrail: ["Merseyrail"],
  wmr: ["West Midlands Railway", "WMR"],
  // North America
  amtrak: ["Amtrak"],
  via: ["VIA Rail", "VIA Rail Canada", "VIA"],
  brightline: ["Brightline"],
  "metro-north": ["Metro-North", "Metro-North Railroad", "MNR"],
  lirr: ["LIRR", "Long Island Rail Road"],
  "nj-transit": ["NJ Transit", "NJT"],
  caltrain: ["Caltrain"],
  metra: ["Metra"],
  go: ["GO Transit", "GO"],
  // Australia and New Zealand
  "sydney-trains": ["Sydney Trains"],
  "queensland-rail": ["Queensland Rail", "QR", "Tilt Train"],
  transperth: ["Transperth"],
  "auckland-transport": ["Auckland Transport", "AT", "AT Metro"],
  "nsw-trainlink": ["NSW TrainLink", "TrainLink"],
  vline: ["V/Line", "VLine"],
  "metro-melbourne": ["Metro Trains Melbourne", "Metro Trains", "Metro Melbourne"],
  "adelaide-metro": ["Adelaide Metro"],
  kiwirail: ["KiwiRail", "Great Journeys of New Zealand", "Great Journeys NZ", "TranzAlpine", "Northern Explorer", "Coastal Pacific", "Te Huia"],
  metlink: ["Metlink"],
  // Morocco
  oncf: ["ONCF", "Office National des Chemins de Fer", "摩洛哥铁路", "摩洛哥國鐵"],
  "al-boraq": ["Al Boraq", "Boraq", "البراق"],
};

// "České dráhy" -> "ceskedrahy", "JR 東日本" -> "jr東日本"
const normalize = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

const FILES: Record<string, string> = logos;
const BY_NAME = new Map(
  Object.entries(NAMES)
    .filter(([id]) => id in FILES)
    .flatMap(([id, names]) => names.map((name) => [normalize(name), id] as const))
);

// The logo of the company a journey names, if there is one
export function railLogo(company: string) {
  const id = BY_NAME.get(normalize(company));
  return id ? `/carriers/rail/${FILES[id]}` : null;
}
