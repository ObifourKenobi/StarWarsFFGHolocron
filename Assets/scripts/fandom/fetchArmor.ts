import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface ArmorItem {
	name: string;
	defense: number;
	soak: number;
	hardPoints: number;
	encumbrance: number;
	restricted: string;
	price: string;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
	const url =
		"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Armor&format=json";
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

function toArmorItem(cells: Element[]): ArmorItem | null {
	if (cells.length < 8) return null;

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
		defense: toInteger(extractCellText(cells[1])),
		soak: toInteger(extractCellText(cells[2])),
		hardPoints: toInteger(extractCellText(cells[3])),
		encumbrance: toInteger(extractCellText(cells[4])),
		restricted: extractCellText(cells[5]),
		price: extractCellText(cells[6]),
		rarity: extractCellText(cells[7]),
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(tableElement: Element): ArmorItem[] {
	const armors: ArmorItem[] = [];
	const rows = tableElement.querySelectorAll("tr");

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const armor = toArmorItem(Array.from(cells));
		if (armor) {
			armors.push(armor);
		}
	}

	return armors;
}

export async function fetchArmorData(): Promise<{
	items: ArmorItem[];
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
	const allArmor = Array.from(tables).flatMap((table) => parseTable(table));

	// Deduplicate by name
	const armorMap = new Map<string, ArmorItem>();
	for (const armor of allArmor) {
		if (!armorMap.has(armor.name)) {
			armorMap.set(armor.name, armor);
		}
	}

	const items = Array.from(armorMap.values());

	const outputDir = new URL("./list", import.meta.url).pathname;
	await Deno.mkdir(outputDir, { recursive: true });

	const outputFile = join(outputDir, "armor.json");
	await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));

	return { items, outputFile };
}
