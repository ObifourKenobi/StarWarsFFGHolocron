import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface ShipItem {
  name: string;
  silhouette: number;
  speed: number;
  handling: string;
  defense: string;
  armor: string;
  hullTrauma: number;
  systemStrain: number;
  restricted: boolean;
  price: string;
  rarity: string;
  sourceURL: string;
  sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
  const url =
    "https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Starships&format=json";
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

function toShipItem(cells: Element[]): ShipItem | null {
  if (cells.length < 11) return null;

  const nameCell = cells[0];
  const name = extractCellText(nameCell);
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
    silhouette: toInteger(extractCellText(cells[1])),
    speed: toInteger(extractCellText(cells[2])),
    handling: extractCellText(cells[3]),
    defense: extractCellText(cells[4]),
    armor: extractCellText(cells[5]),
    hullTrauma: toInteger(extractCellText(cells[6])),
    systemStrain: toInteger(extractCellText(cells[7])),
    restricted: extractCellText(cells[8]) === "(R)",
    price: extractCellText(cells[9]).replace(/,/g, ""),
    rarity: extractCellText(cells[10]),
    sourceURL,
    sourceAPIURL,
  };
}

function parseTable(tableElement: Element): ShipItem[] {
  const ships: ShipItem[] = [];
  const rows = tableElement.querySelectorAll("tr");

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length === 0) continue;

    const ship = toShipItem(Array.from(cells));
    if (ship) {
      ships.push(ship);
    }
  }

  return ships;
}

export async function fetchShipsData(): Promise<{
  items: ShipItem[];
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
  const allShips = Array.from(tables).flatMap((table) => parseTable(table));

  // Deduplicate by name
  const shipMap = new Map<string, ShipItem>();
  for (const ship of allShips) {
    if (!shipMap.has(ship.name)) {
      shipMap.set(ship.name, ship);
    }
  }

  const items = Array.from(shipMap.values());
  console.log(`Found ${items.length} ships`);

  const outputDir = new URL("./list", import.meta.url).pathname;
  await Deno.mkdir(outputDir, { recursive: true });

  const outputFile = join(outputDir, "ships.json");
  await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));
  console.log(`Saved ${items.length} ships to ${outputFile}`);

  return { items, outputFile };
}
