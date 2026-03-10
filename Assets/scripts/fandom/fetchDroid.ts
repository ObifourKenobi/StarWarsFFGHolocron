import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import {
	buildSourceInfoFromCell,
	extractCellText,
	logFound,
	toInteger,
	writeJsonList,
} from "./util.ts";

interface DroidItem {
	category: string;
	model: string;
	npc: string;
	brawn: number;
	agility: number;
	intellect: number;
	cunning: number;
	willpower: number;
	presence: number;
	soak: number;
	woundThreshold: number;
	strainThreshold: number;
	meleeDefense: number;
	rangedDefense: number;
	skills: string;
	restricted: boolean;
	price: string;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
	const url =
		"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Droid&format=json";
	const response = await fetch(url);
	const data = await response.json();
	return data.parse.text["*"];
}

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";

function parseDroidAbilities(cellText: string): {
	brawn: number;
	agility: number;
	intellect: number;
	cunning: number;
	willpower: number;
	presence: number;
} {
	const abilities = cellText.split("/").map((a) => toInteger(a.trim()));
	return {
		brawn: abilities[0] || 0,
		agility: abilities[1] || 0,
		intellect: abilities[2] || 0,
		cunning: abilities[3] || 0,
		willpower: abilities[4] || 0,
		presence: abilities[5] || 0,
	};
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

function toDroidItem(cells: Element[], category: string): DroidItem | null {
	if (cells.length < 11) return null;

	const modelCell = cells[0];
	const model = extractCellText(modelCell);
	if (!model) return null;

	// Extract URL from the link in the model cell
	const { sourceURL, sourceAPIURL } = buildSourceInfoFromCell(
		modelCell,
		BASE_URL,
	);

	// Parse columns: Model | NPC | Br/Ag/Int/Cun/Wil/Pr | Soak | WT | ST | M/R Def. | Skills | (R) | Price | Rarity
	const npc = extractCellText(cells[1]);
	const abilities = parseDroidAbilities(extractCellText(cells[2]));
	const soak = toInteger(extractCellText(cells[3]));
	const woundThreshold = toInteger(extractCellText(cells[4]));
	const strainThreshold = toInteger(extractCellText(cells[5]));
	const defense = parseDefense(extractCellText(cells[6]));
	const skills = extractCellText(cells[7]);
	const restricted = extractCellText(cells[8]) === "(R)";
	const price = extractCellText(cells[9]).replace(/,/g, "");
	const rarity = extractCellText(cells[10]);

	return {
		category,
		model,
		npc,
		brawn: abilities.brawn,
		agility: abilities.agility,
		intellect: abilities.intellect,
		cunning: abilities.cunning,
		willpower: abilities.willpower,
		presence: abilities.presence,
		soak,
		woundThreshold,
		strainThreshold,
		meleeDefense: defense.melee,
		rangedDefense: defense.ranged,
		skills,
		restricted,
		price,
		rarity,
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(tableElement: Element, category: string): DroidItem[] {
	const droids: DroidItem[] = [];
	const rows = tableElement.querySelectorAll("tr");

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const droid = toDroidItem(Array.from(cells), category);
		if (droid) {
			droids.push(droid);
		}
	}

	return droids;
}

export async function fetchDroidData(): Promise<{
	items: DroidItem[];
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

	// Get all h2 headers (categories)
	const headers = scope.querySelectorAll("h2");
	const children = Array.from(scope.children);
	const allDroids: DroidItem[] = [];

	// For each h2 header, find the next table and parse it
	for (const header of headers) {
		let headerText = extractCellText(header).trim();
		
		// Skip "Contents" header
		if (headerText === "Contents") continue;

		// Clean up the header text (remove empty brackets)
		headerText = headerText.replace(/\[\s*\]\s*$/, "").trim();

		// Find the position of this header in the children
		const headerIndex = children.indexOf(header);
		if (headerIndex === -1) continue;

		// Find the next table after this header
		for (let i = headerIndex + 1; i < children.length; i++) {
			const child = children[i];
			const tagName = child.tagName?.toLowerCase();

			// Stop if we hit another header
			if (tagName === "h2") break;

			// Parse the table if we find one
			if (tagName === "table" && child.classList?.contains("article-table")) {
				const droids = parseTable(child, headerText);
				allDroids.push(...droids);
				break;
			}
		}
	}

	// Deduplicate by model
	const droidMap = new Map<string, DroidItem>();
	for (const droid of allDroids) {
		if (!droidMap.has(droid.model)) {
			droidMap.set(droid.model, droid);
		}
	}

	const items = Array.from(droidMap.values());
	logFound(items.length, "droids");

	const outputFile = await writeJsonList(
		import.meta.url,
		"droids.json",
		items,
		"droids",
	);

	return { items, outputFile };
}
