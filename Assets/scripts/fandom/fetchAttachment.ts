import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import {
	buildSourceInfoFromCell,
	extractCellText,
	logFound,
	toInteger,
	writeJsonList,
} from "./util.ts";

interface AttachmentItem {
	name: string;
	hardPoints: number;
	encumbrance: number;
	restricted: boolean;
	price: number;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchHtml(): Promise<string> {
	const url =
		"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Attachments&format=json";
	const response = await fetch(url);
	const data = await response.json();
	return data.parse.text["*"];
}

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";

function toAttachmentItem(cells: Element[]): AttachmentItem | null {
	if (cells.length < 6) return null;

	const nameCell = cells[0];
	const name = extractCellText(nameCell, { removeQuotes: true });
	if (!name) return null;

	// Extract URL from the link in the name cell
	const { sourceURL, sourceAPIURL } = buildSourceInfoFromCell(
		nameCell,
		BASE_URL,
	);

	// Parse columns: Type | HP Req | Encum | (R) | Price | Rarity
	const encumText = extractCellText(cells[2]);

	return {
		name,
		hardPoints: toInteger(extractCellText(cells[1])),
		encumbrance: encumText === "-" ? 0 : toInteger(encumText),
		restricted: extractCellText(cells[3]) === "(R)",
		price: toInteger(extractCellText(cells[4]).replace(/,/g, "")),
		rarity: extractCellText(cells[5]),
		sourceURL,
		sourceAPIURL,
	};
}

function parseTable(tableElement: Element): AttachmentItem[] {
	const attachments: AttachmentItem[] = [];
	const rows = tableElement.querySelectorAll("tr");

	for (const row of rows) {
		const cells = row.querySelectorAll("td");
		if (cells.length === 0) continue;

		const attachment = toAttachmentItem(Array.from(cells));
		if (attachment) {
			attachments.push(attachment);
		}
	}

	return attachments;
}

export async function fetchAttachmentData(): Promise<{
	items: AttachmentItem[];
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
	const allAttachments = Array.from(tables).flatMap((table) =>
		parseTable(table)
	);

	// Deduplicate by name
	const attachmentMap = new Map<string, AttachmentItem>();
	for (const attachment of allAttachments) {
		if (!attachmentMap.has(attachment.name)) {
			attachmentMap.set(attachment.name, attachment);
		}
	}

	const items = Array.from(attachmentMap.values());
	logFound(items.length, "attachments");

	const outputFile = await writeJsonList(
		import.meta.url,
		"attachments.json",
		items,
		"attachments",
	);

	return { items, outputFile };
}
