import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface WeaponItem {
  name: string;
  skill: string;
  damage: string;
  critical: string;
  range: string;
  encumbrance: number;
  hardPoints: number;
  restricted: boolean;
  price: string;
  rarity: string;
  special: string;
  sourceURL: string;
  sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
  const url =
    "https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Weapon&format=json";
  const response = await fetch(url);
  const data = await response.json();
  return data.parse.text["*"];
}

function extractCellText(cell: Element): string {
  let text = cell.textContent || "";
  text = text.replace(/\s*\[\d+\]\s*/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function toInteger(value: string): number {
  const cleaned = value.replace(/[^0-9-]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function toWeaponItem(cells: Element[]): WeaponItem | null {
  if (cells.length < 11) return null;

  const nameCell = cells[0];
  const name = extractCellText(nameCell).replace(/"/g, "");
  if (!name) return null;

  // Extract URL from the link in the name cell
  const link = nameCell.querySelector("a");
  const href = link?.getAttribute("href") || "";
  const pageName = href.replace(/^\/wiki\//, "");
  const sourceURL = href ? `https://star-wars-rpg-ffg.fandom.com${href}` : "";
  const sourceAPIURL = pageName
    ? `https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageName)}&format=json`
    : "";

  return {
    name,
    skill: extractCellText(cells[1]),
    damage: extractCellText(cells[2]),
    critical: extractCellText(cells[3]) === "-" ? "0" : extractCellText(cells[3]),
    range: extractCellText(cells[4]),
    encumbrance: toInteger(extractCellText(cells[5])),
    hardPoints: toInteger(extractCellText(cells[6])),
    restricted: extractCellText(cells[7]) === "(R)",
    price: extractCellText(cells[8]).replace(/,/g, ""),
    rarity: extractCellText(cells[9]),
    special: extractCellText(cells[10]),
    sourceURL,
    sourceAPIURL,
  };
}

function parseTable(tableElement: Element): WeaponItem[] {
  const weapons: WeaponItem[] = [];
  const rows = tableElement.querySelectorAll("tr");

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length === 0) continue;

    const weapon = toWeaponItem(Array.from(cells));
    if (weapon) {
      weapons.push(weapon);
    }
  }

  return weapons;
}

export async function fetchWeaponData(): Promise<{
  items: WeaponItem[];
  outputFile: string;
}> {
  const html = await fetchHtml();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (!doc) {
    throw new Error("Failed to parse HTML");
  }

  const scope = doc.querySelector(".mw-content-ltr.mw-parser-output");
  if (!scope) {
    throw new Error("Could not find content scope");
  }

  const tables = scope.querySelectorAll("table.article-table");
  const allWeapons = Array.from(tables).flatMap((table) => parseTable(table));

  // Deduplicate by name
  const weaponMap = new Map<string, WeaponItem>();
  for (const weapon of allWeapons) {
    if (!weaponMap.has(weapon.name)) {
      weaponMap.set(weapon.name, weapon);
    }
  }

  const items = Array.from(weaponMap.values());
  console.log(`Found ${items.length} weapons`);

  const outputDir = new URL("./list", import.meta.url).pathname;
  await Deno.mkdir(outputDir, { recursive: true });

  const outputFile = join(outputDir, "weapons.json");
  await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));
  console.log(`Saved ${items.length} weapons to ${outputFile}`);

  return { items, outputFile };
}

if (import.meta.main) {
  const result = await fetchWeaponData();
  console.log(`Fetched ${result.items.length} weapons to ${result.outputFile}`);
}
