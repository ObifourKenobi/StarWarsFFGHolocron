// api page https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={PAGE_TITLE}&format=json
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import {
	buildSourceInfoFromCell,
	extractCellText,
	logFound,
	toInteger,
	writeJsonList,
} from "./util.ts";

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
	price: number;
	rarity: number;
	sourceURL: string;
	sourceAPIURL: string;
};

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const PAGE_TITLE = "Category:Vehicles";
const CONTENT_SELECTOR = ".mw-content-ltr.mw-parser-output";
const TABLE_SELECTOR = "table.article-table";
const OUTPUT_FILE_NAME = "vehicles.json";


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
		price: toInteger(extractCellText(cells[9]).replace(/,/g, "")),
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
	logFound(deduped.length, "vehicles");

	const outputFile = await writeJsonList(
		import.meta.url,
		OUTPUT_FILE_NAME,
		deduped,
		"vehicles",
	);

	return { items: deduped, outputFile };
}
