// api page https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={PAGE_TITLE}&format=json
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

type VehicleItem = {
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
	rarity: number;
	sourceURL: string;
	sourceAPIURL: string;
};

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const PAGE_TITLE = "Category:Vehicles";
const CONTENT_SELECTOR = ".mw-content-ltr.mw-parser-output";
const TABLE_SELECTOR = "table.article-table";
const OUTPUT_FILE_NAME = "vehicles.json";

function extractCellText(cell: Element): string {
	const raw = cell.textContent ?? "";
	return raw
		.replace(/\u00a0/g, " ")
		.replace(/\[[0-9]+\]/g, "")
		.replace(/\s*\n\s*/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function toInteger(value: string): number {
	const parsed = Number(value.replace(/[^0-9-]/g, ""));
	return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toVehicleItem(cells: Element[]): VehicleItem | null {
	if (cells.length < 11) {
		return null;
	}

	const nameCell = cells[0];
	const name = extractCellText(nameCell).trim();
	if (name === "") {
		return null;
	}

	// Extract URL from the link in the name cell
	const link = nameCell.querySelector("a");
	const href = link?.getAttribute("href") || "";
	const pageName = href.replace(/^\/wiki\//, "");
	const sourceURL = href ? `${BASE_URL}${href}` : "";
	const sourceAPIURL = pageName
		? `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(pageName)}&format=json`
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
		rarity: toInteger(extractCellText(cells[10])),
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(table: Element): VehicleItem[] {
	const rows = table.querySelectorAll("tr");
	const results: VehicleItem[] = [];

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length < 11) {
			continue;
		}

		const item = toVehicleItem([...cells]);
		if (item) {
			results.push(item);
		}
	}

	return results;
}

async function fetchHtml(): Promise<string> {
	const apiUrl = `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&format=json`;
	const response = await fetch(apiUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch page: ${PAGE_TITLE} (${response.status})`);
	}

	const payload = await response.json();
	const html = payload?.parse?.text?.["*"];
	if (!html || typeof html !== "string") {
		throw new Error(`Missing HTML for page: ${PAGE_TITLE}`);
	}

	return html;
}

export async function fetchVehiclesData(): Promise<{ items: VehicleItem[]; outputFile: string }> {
	const html = await fetchHtml();
	const document = new DOMParser().parseFromString(html, "text/html");
	if (!document) {
		throw new Error("Failed to parse HTML response.");
	}

	const scope = document.querySelector(CONTENT_SELECTOR) ?? document;
	const tables = [...scope.querySelectorAll(TABLE_SELECTOR)];
	if (tables.length === 0) {
		throw new Error("No vehicle tables found on the page.");
	}

	const items = tables.flatMap((table) => parseTable(table));
	const deduped = [...new Map(items.map((item) => [item.name, item])).values()];
	console.log(`Found ${deduped.length} vehicles`);

	const outputDir = join(dirname(fromFileUrl(import.meta.url)), "list");
	await Deno.mkdir(outputDir, { recursive: true });
	const outputFile = join(outputDir, OUTPUT_FILE_NAME);

	await Deno.writeTextFile(outputFile, JSON.stringify(deduped, null, 2));
	console.log(`Saved ${deduped.length} vehicles to ${outputFile}`);

	return { items: deduped, outputFile };
}
