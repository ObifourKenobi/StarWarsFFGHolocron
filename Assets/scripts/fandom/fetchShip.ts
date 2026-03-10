import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import {
  buildSourceInfoFromCell,
  extractCellText,
  logFound,
  toInteger,
  writeJsonList,
} from "./util.ts";

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

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";

function toShipItem(cells: Element[]): ShipItem | null {
  if (cells.length < 11) return null;

  const nameCell = cells[0];
  const name = extractCellText(nameCell);
  if (!name) return null;

  // Extract URL from the link in the name cell
  const { sourceURL, sourceAPIURL } = buildSourceInfoFromCell(
    nameCell,
    BASE_URL,
  );

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
  logFound(items.length, "ships");

  const outputFile = await writeJsonList(
    import.meta.url,
    "ships.json",
    items,
    "ships",
  );

  return { items, outputFile };
}
