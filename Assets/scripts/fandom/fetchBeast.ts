import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface BeastItem {
	name: string;
	brawn: number;
	agility: number;
	intellect: number;
	cunning: number;
	willpower: number;
	presence: number;
	soak: number;
	woundThreshold: number;
	meleeDefense: number;
	rangedDefense: number;
	restricted: boolean;
	price: string;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
	const url =
		"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Beast&format=json";
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

function parseDefense(cellText: string): {
	melee: number;
	ranged: number;
} {
	const parts = cellText.split("/").map((d) => toInteger(d.trim()));
	return {
		melee: parts[0] || 0,
		ranged: parts[1] || 0,
	};
}

function toBeastItem(cells: Element[]): BeastItem | null {
	if (cells.length < 13) return null;

	const nameCell = cells[0];
	const name = extractCellText(nameCell);
	if (!name) return null;

	// Extract URL from the link in the name cell
	const link = nameCell.querySelector("a");
	const href = link?.getAttribute("href") || "";
	const pageName = href.replace(/^\/wiki\//, "");
	const sourceURL = href
		? `https://star-wars-rpg-ffg.fandom.com${href}`
		: "";
	const sourceAPIURL = pageName
		? `https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageName)}&format=json`
		: "";

	// Parse columns: Name | Br | Ag | Int | Cun | Will | Pr | Soak | WT | M/R Def. | (R) | Price | Rarity
	const defense = parseDefense(extractCellText(cells[9]));

	return {
		name,
		brawn: toInteger(extractCellText(cells[1])),
		agility: toInteger(extractCellText(cells[2])),
		intellect: toInteger(extractCellText(cells[3])),
		cunning: toInteger(extractCellText(cells[4])),
		willpower: toInteger(extractCellText(cells[5])),
		presence: toInteger(extractCellText(cells[6])),
		soak: toInteger(extractCellText(cells[7])),
		woundThreshold: toInteger(extractCellText(cells[8])),
		meleeDefense: defense.melee,
		rangedDefense: defense.ranged,
		restricted: extractCellText(cells[10]) === "(R)",
		price: extractCellText(cells[11]).replace(/,/g, ""),
		rarity: extractCellText(cells[12]),
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(tableElement: Element): BeastItem[] {
	const beasts: BeastItem[] = [];
	const rows = tableElement.querySelectorAll("tr");

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const beast = toBeastItem(Array.from(cells));
		if (beast) {
			beasts.push(beast);
		}
	}

	return beasts;
}

export async function fetchBeastData(): Promise<{
	items: BeastItem[];
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
	const allBeasts = Array.from(tables).flatMap((table) => parseTable(table));

	// Deduplicate by name
	const beastMap = new Map<string, BeastItem>();
	for (const beast of allBeasts) {
		if (!beastMap.has(beast.name)) {
			beastMap.set(beast.name, beast);
		}
	}

	const items = Array.from(beastMap.values());
	console.log(`Found ${items.length} beasts`);

	const outputDir = new URL("./list", import.meta.url).pathname;
	await Deno.mkdir(outputDir, { recursive: true });

	const outputFile = join(outputDir, "beasts.json");
	await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));
	console.log(`Saved ${items.length} beasts to ${outputFile}`);

	return { items, outputFile };
}
