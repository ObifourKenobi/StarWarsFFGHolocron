// api page https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={PAGE_TITLE}&format=json
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { logFound, toInteger, writeJsonList } from "./util.ts";

type SpeciesRow = Record<string, string | number>;
type SpeciesItem = {
	name: string;
	brawn: number;
	agility: number;
	intellect: number;
	cunning: number;
	willpower: number;
	presence: number;
	sourceURL: string;
	sourceAPIURL: string;
};

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const PAGE_TITLE = "Category:Species";
const CONTENT_SELECTOR = ".mw-content-ltr.mw-parser-output";
const TABLE_SELECTOR = "table.article-table";
const OUTPUT_FILE_NAME = "species.json";

function extractCellText(cell: Element): string {
	const raw = cell.textContent ?? "";
	return raw
		.replace(/\u00a0/g, " ")
		.replace(/\[[0-9]+\]/g, "")
		.replace(/\s*\n\s*/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function extractLinkInfo(cell: Element): { sourceURL?: string; sourceAPIURL?: string } {
	const link = cell.querySelector("a");
	if (!link) {
		return {};
	}
	const href = link.getAttribute("href");
	if (!href) {
		return {};
	}
	const sourceURL = new URL(href, BASE_URL).toString();
	const title = link.getAttribute("title") ?? link.textContent?.trim() ?? "";
	const pageTitle = title !== "" ? title : sourceURL.split("/wiki/")[1] ?? "";
	const sourceAPIURL = pageTitle
		? `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&format=json`
		: undefined;

	return { sourceURL, sourceAPIURL };
}

function parseTable(table: Element): SpeciesRow[] {
	const rows = table.querySelectorAll("tr");
	const results: SpeciesRow[] = [];

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length < 7) {
			continue;
		}

		const record: SpeciesRow = {
			name: extractCellText(cells[0]),
			brawn: extractCellText(cells[1]),
			agility: extractCellText(cells[2]),
			intellect: extractCellText(cells[3]),
			cunning: extractCellText(cells[4]),
			willpower: extractCellText(cells[5]),
			presence: extractCellText(cells[6]),
		};

		const linkInfo = extractLinkInfo(cells[0]);
		if (linkInfo.sourceURL) {
			record.sourceURL = linkInfo.sourceURL;
		}
		if (linkInfo.sourceAPIURL) {
			record.sourceAPIURL = linkInfo.sourceAPIURL;
		}

		if (Object.keys(record).length > 0) {
			results.push(record);
		}
	}

	return results;
}


function toSpeciesItem(record: SpeciesRow): SpeciesItem | null {
	if (typeof record.name !== "string" || record.name.trim() === "") {
		return null;
	}

	const name = record.name.trim();
	const sourceURL = typeof record.sourceURL === "string" && record.sourceURL.trim() !== ""
		? record.sourceURL
		: `${BASE_URL}/wiki/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
	const sourceAPIURL = typeof record.sourceAPIURL === "string" && record.sourceAPIURL.trim() !== ""
		? record.sourceAPIURL
		: `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(name)}&format=json`;

	return {
		name,
		brawn: toInteger(record.brawn),
		agility: toInteger(record.agility),
		intellect: toInteger(record.intellect),
		cunning: toInteger(record.cunning),
		willpower: toInteger(record.willpower),
		presence: toInteger(record.presence),
		sourceURL,
		sourceAPIURL,
	};
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

export async function fetchSpeciesData(): Promise<{ items: SpeciesRow[]; outputFile: string }> {
	const html = await fetchHtml();
	const document = new DOMParser().parseFromString(html, "text/html");
	if (!document) {
		throw new Error("Failed to parse HTML response.");
	}

	const scope = document.querySelector(CONTENT_SELECTOR) ?? document;
	const tables = [...scope.querySelectorAll(TABLE_SELECTOR)];
	if (tables.length === 0) {
		throw new Error("No species tables found on the page.");
	}

	const rawItems = tables.flatMap((table) => parseTable(table));
	const uniqueByName = new Map<string, SpeciesItem>();
	for (const row of rawItems) {
		const item = toSpeciesItem(row);
		if (!item) {
			continue;
		}
		if (!uniqueByName.has(item.name)) {
			uniqueByName.set(item.name, item);
		}
	}
	const items = [...uniqueByName.values()];
	logFound(items.length, "species");
	const outputFile = await writeJsonList(
		import.meta.url,
		OUTPUT_FILE_NAME,
		items,
		"species",
	);
	return { items, outputFile };
}