import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import { extractCellText, logFound, writeJsonList } from "./util.ts";

interface QualityItem {
	name: string;
	activation: string;
	effect: string;
	description: string;
}

const PAGE_URL = "https://star-wars-rpg-ffg.fandom.com/wiki/Item_Qualities";
const API_URL =
	"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Item_Qualities&format=json";

async function fetchHtml(): Promise<string> {
	const response = await fetch(API_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch Item_Qualities (${response.status})`);
	}
	const data = await response.json();
	return data.parse.text["*"];
}

function toQualityItem(cells: Element[]): QualityItem | null {
	if (cells.length < 3) return null;

	const name = extractCellText(cells[0]);
	if (!name) return null;

	return {
		name,
		activation: extractCellText(cells[1]),
		effect: extractCellText(cells[2]),
		description: "",
	};
}

function normalizeName(value: string): string {
	return value
		.replace(/\[.*\]$/, "")
		.replace(/\s*\(.*\)\s*$/, "")
		.replace(/\s+X$/i, "")
		.trim()
		.toLowerCase();
}

function buildDescriptionMap(scope: Element): Map<string, string> {
	const map = new Map<string, string>();
	const headings = scope.querySelectorAll("h2, h3");

	for (const heading of headings) {
		const headingText = extractCellText(heading);
		if (!headingText || headingText === "Contents") {
			continue;
		}
		const key = normalizeName(headingText);
		if (!key) {
			continue;
		}

		let next = heading.nextElementSibling;
		let description = "";
		while (next) {
			const tag = next.tagName?.toLowerCase();
			if (tag === "h2" || tag === "h3") {
				break;
			}
			if (tag === "p") {
				const text = extractCellText(next)
					.replace(/\[([A-Za-z])\]/g, "$1")
					.replace(/"/g, "");
				if (text) {
					description = text;
					break;
				}
			}
			next = next.nextElementSibling;
		}

		if (description) {
			map.set(key, description);
		}
	}

	return map;
}

function parseTable(
	table: Element,
	descriptionMap: Map<string, string>,
): QualityItem[] {
	const rows = table.querySelectorAll("tr");
	const items: QualityItem[] = [];

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const item = toQualityItem(Array.from(cells));
		if (item) {
			const key = normalizeName(item.name);
			item.description = descriptionMap.get(key) ?? "";
			items.push(item);
		}
	}

	return items;
}

export async function fetchQualityData(): Promise<{
	items: QualityItem[];
	outputFile: string;
}> {
	console.log(`Fetching qualities from ${PAGE_URL}...`);

	const html = await fetchHtml();
	const doc = new DOMParser().parseFromString(html, "text/html");
	if (!doc) {
		throw new Error("Failed to parse HTML");
	}

	const scope = doc.querySelector(".mw-content-ltr.mw-parser-output") ?? doc;
	const descriptionMap = buildDescriptionMap(scope);
	const tables = scope.querySelectorAll("table.mw-collapsible.fandom-table");

	const allItems = Array.from(tables).flatMap((table) =>
		parseTable(table, descriptionMap)
	);
	const items = allItems.filter((item) => item.name !== "");

	logFound(items.length, "qualities");
	const outputFile = await writeJsonList(
		import.meta.url,
		"qualities.json",
		items,
		"qualities",
	);

	return { items, outputFile };
}

if (import.meta.main) {
	await fetchQualityData();
}
