import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import {
	buildSourceInfoFromCell,
	extractCellText,
	logFound,
	toInteger,
	writeJsonList,
} from "./util.ts";

interface ArmorItem {
	name: string;
	defense: number;
	soak: number;
	hardPoints: number;
	encumbrance: number;
	restricted: boolean;
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

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";

function toArmorItem(cells: Element[]): ArmorItem | null {
	if (cells.length < 8) return null;

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
		defense: toInteger(extractCellText(cells[1])),
		soak: toInteger(extractCellText(cells[2])),
		hardPoints: toInteger(extractCellText(cells[3])),
		encumbrance: toInteger(extractCellText(cells[4])),
		restricted: extractCellText(cells[5]) === "(R)",
		price: extractCellText(cells[6]).replace(/,/g, ""),
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
	logFound(items.length, "armor");

	const outputFile = await writeJsonList(
		import.meta.url,
		"armor.json",
		items,
		"armor",
	);

	return { items, outputFile };
}
