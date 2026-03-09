import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface GearItem {
	name: string;
	encumbrance: number;
	price: string;
	rarity: string;
	restricted: boolean;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
	const url =
		"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Gear&format=json";
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

function toGearItem(cells: Element[]): GearItem | null {
	if (cells.length < 5) return null;

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

	// Parse columns by position: Item | Encumbrance | Restriction | Price | Rarity
	const encumbranceText = extractCellText(cells[1]);
	const restricted = extractCellText(cells[2]) === "(R)";
	const price = extractCellText(cells[3]).replace(/,/g, "");
	const rarityText = extractCellText(cells[4]);

	// Convert encumbrance to number (handle "-" for dashes)
	const encumbrance =
		encumbranceText === "-" || encumbranceText === ""
			? 0
			: toInteger(encumbranceText);
	const rarity = rarityText === "" ? "" : rarityText;

	return {
		name,
		encumbrance,
		price,
		rarity,
		restricted,
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(tableElement: Element): GearItem[] {
	const gears: GearItem[] = [];
	const rows = tableElement.querySelectorAll("tr");

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const gear = toGearItem(Array.from(cells));
		if (gear) {
			gears.push(gear);
		}
	}

	return gears;
}

export async function fetchGearData(): Promise<{
	items: GearItem[];
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
	const allGear = Array.from(tables).flatMap((table) => parseTable(table));

	// Deduplicate by name
	const gearMap = new Map<string, GearItem>();
	for (const gear of allGear) {
		if (!gearMap.has(gear.name)) {
			gearMap.set(gear.name, gear);
		}
	}

	const items = Array.from(gearMap.values());
	console.log(`Found ${items.length} gear`);

	const outputDir = new URL("./list", import.meta.url).pathname;
	await Deno.mkdir(outputDir, { recursive: true });

	const outputFile = join(outputDir, "gear.json");
	await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));
	console.log(`Saved ${items.length} gear to ${outputFile}`);

	return { items, outputFile };
}
