import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import { BookItem, BookSourceItem, mapReferencesToBooks } from "./util.ts";

type ArmorItem = {
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
	subtitle?: string;
	description?: string;
	books?: BookSourceItem[];
};

const EXCLUDED_TEXT =
	"More information about the armor available on the Wookieepedia article.";
const FETCH_BATCH_SIZE = 20;
const FETCH_BATCH_DELAY_MS = 250;

function cleanText(value: string): string {
	return value
		.replace(/\u00a0/g, " ")
		.replace(/\s*\[[0-9A-Za-z]+\]\s*/g, " ")
		.replace(/\s+/g, " ")
		.replace(new RegExp(EXCLUDED_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
		.trim();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function paragraphText(paragraph: Element): string {
	const text = cleanText(paragraph.textContent ?? "");
	return text;
}

function pickSubtitleAndDescription(scope: Element): {
	subtitle: string;
	description: string;
} {
	const paragraphs = Array.from(scope.querySelectorAll("p"));
	const valid = paragraphs
		.map((p) => paragraphText(p))
		.filter((text) => text.length > 0 && text !== EXCLUDED_TEXT);

	return {
		subtitle: valid[0] ?? "",
		description: valid[1] ?? "",
	};
}

/** Normalize double-encoded URLs (e.g. %2522 → %22) that may exist in stored JSON. */
function normalizeUrl(url: string): string {
	return url.replace(/%25([0-9A-Fa-f]{2})/g, "%$1");
}

async function fetchPageHtml(sourceAPIURL: string): Promise<string> {
	const response = await fetch(normalizeUrl(sourceAPIURL));
	if (!response.ok) {
		throw new Error(`Failed to fetch ${sourceAPIURL} (${response.status})`);
	}

	const data = await response.json();
	return data?.parse?.text?.["*"] ?? "";
}

async function enrichArmorDetail(
	armor: ArmorItem,
	books: BookItem[],
): Promise<void> {
	if (!armor.sourceAPIURL) {
		armor.subtitle = armor.subtitle ?? "";
		armor.description = armor.description ?? "";
		armor.books = armor.books ?? [];
		return;
	}

	try {
		const html = await fetchPageHtml(armor.sourceAPIURL);
		const doc = new DOMParser().parseFromString(html, "text/html");
		if (!doc) {
			throw new Error("Failed to parse HTML");
		}

		const scope =
			doc.querySelector(".mw-content-ltr.mw-parser-output") ??
			doc.querySelector(".mw-parser-output") ??
			doc;

		const { subtitle, description } = pickSubtitleAndDescription(scope);
		const mappedBooks = mapReferencesToBooks(scope, books);

		armor.subtitle = subtitle;
		armor.description = description;
		armor.books = mappedBooks;
	} catch (error) {
		console.warn(
			`Failed details for ${armor.name}: ${error instanceof Error ? error.message : String(error)}`,
		);
		armor.subtitle = armor.subtitle ?? "";
		armor.description = armor.description ?? "";
		armor.books = armor.books ?? [];
	}
}

export async function fetchDetailsArmorData(): Promise<{
	items: ArmorItem[];
	outputFile: string;
}> {
	const armorFile = new URL("./list/armor.json", import.meta.url).pathname;
	const booksFile = new URL("./list/books.json", import.meta.url).pathname;

	const [armorText, booksText] = await Promise.all([
		Deno.readTextFile(armorFile),
		Deno.readTextFile(booksFile),
	]);

	const armors = JSON.parse(armorText) as ArmorItem[];
	const books = JSON.parse(booksText) as BookItem[];

	for (let start = 0; start < armors.length; start += FETCH_BATCH_SIZE) {
		const batch = armors.slice(start, start + FETCH_BATCH_SIZE);
		await Promise.all(batch.map((armor) => enrichArmorDetail(armor, books)));

		const processed = Math.min(start + FETCH_BATCH_SIZE, armors.length);
		console.log(`Processed ${processed}/${armors.length} armor details`);

		if (processed < armors.length) {
			await sleep(FETCH_BATCH_DELAY_MS);
		}
	}

	await Deno.writeTextFile(armorFile, JSON.stringify(armors, null, 2));
	console.log(`Saved ${armors.length} armor details to ${armorFile}`);

	return { items: armors, outputFile: armorFile };
}

if (import.meta.main) {
	await fetchDetailsArmorData();
}