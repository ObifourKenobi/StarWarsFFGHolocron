import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import { BookItem, BookSourceItem, mapReferencesToBooks } from "./util.ts";

type BeastItem = {
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
	price: number;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
	subtitle?: string;
	description?: string;
	skills?: string;
	talents?: string;
	abilities?: string;
	equipment?: string;
	books?: BookSourceItem[];
};

const EXCLUDED_TEXT =
	"More information about the beast available on the Wookieepedia article.";
const FETCH_BATCH_SIZE = 5;
const FETCH_BATCH_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string): string {
	return value
		.replace(/\u00a0/g, " ")
		.replace(/\s*\[[0-9A-Za-z]+\]\s*/g, " ")
		.replace(/\s+/g, " ")
		.replace(new RegExp(EXCLUDED_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
		.trim();
}

/** Strip <sup> tags, then return cleaned textContent. */
function getCleanText(el: Element): string {
	const html = el.innerHTML.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "");
	const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	return cleanText(parsed?.querySelector("div")?.textContent ?? el.textContent ?? "");
}

function isImageOnlyParagraph(el: Element): boolean {
	return (el.textContent ?? "").replace(/\s/g, "").length === 0;
}

function isLabeledParagraph(text: string): boolean {
	return /(?:Skills|Talents|Abilities|Equipment)\s*:/i.test(text);
}

/**
 * Extract a labeled field from a paragraph containing multiple bold-labeled sections.
 * Example: "Skills: Brawl 1. Talents: None. Abilities: Silhouette 2. Equipment: Horns..."
 */
function extractField(text: string, label: string): string {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`${escaped}\\s*:\\s*(.*?)(?=\\s*(?:Skills|Talents|Abilities|Equipment)\\s*:|$)`,
		"is",
	);
	return text.match(pattern)?.[1]?.trim() ?? "";
}

/**
 * Parse subtitle, description, and beast stat block fields from the page scope.
 * - subtitle: first valid non-excluded paragraph
 * - description: remaining unlabeled paragraphs + any <pre> blocks
 * - skills / talents / abilities / equipment: from the labeled paragraph
 */
function pickBeastContent(scope: Element): {
	subtitle: string;
	description: string;
	skills: string;
	talents: string;
	abilities: string;
	equipment: string;
} {
	const paragraphs = Array.from(scope.querySelectorAll("p"));
	const preBlocks = Array.from(scope.querySelectorAll("pre"));

	let subtitle = "";
	const descParts: string[] = [];
	let skills = "";
	let talents = "";
	let abilities = "";
	let equipment = "";

	for (const p of paragraphs) {
		if (isImageOnlyParagraph(p)) continue;
		const text = getCleanText(p);
		if (!text || text === EXCLUDED_TEXT) continue;

		if (!subtitle) {
			subtitle = text;
			continue;
		}

		if (isLabeledParagraph(text)) {
			skills = extractField(text, "Skills");
			talents = extractField(text, "Talents");
			abilities = extractField(text, "Abilities");
			equipment = extractField(text, "Equipment");
			continue;
		}

		descParts.push(text);
	}

	for (const pre of preBlocks) {
		const text = cleanText(pre.textContent ?? "");
		if (text) {
			descParts.push(text);
		}
	}

	return {
		subtitle,
		description: descParts.join(" ").trim(),
		skills,
		talents,
		abilities,
		equipment,
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

async function enrichBeastDetail(beast: BeastItem, books: BookItem[]): Promise<void> {
	if (!beast.sourceAPIURL) {
		beast.subtitle = beast.subtitle ?? "";
		beast.description = beast.description ?? "";
		beast.skills = beast.skills ?? "";
		beast.talents = beast.talents ?? "";
		beast.abilities = beast.abilities ?? "";
		beast.equipment = beast.equipment ?? "";
		beast.books = beast.books ?? [];
		return;
	}

	try {
		const html = await fetchPageHtml(beast.sourceAPIURL);
		const doc = new DOMParser().parseFromString(html, "text/html");
		if (!doc) throw new Error("Failed to parse HTML");

		const scope =
			doc.querySelector(".mw-content-ltr.mw-parser-output") ??
			doc.querySelector(".mw-parser-output") ??
			doc;

		const { subtitle, description, skills, talents, abilities, equipment } =
			pickBeastContent(scope);
		const mappedBooks = mapReferencesToBooks(scope, books);

		beast.subtitle = subtitle;
		beast.description = description;
		beast.skills = skills;
		beast.talents = talents;
		beast.abilities = abilities;
		beast.equipment = equipment;
		beast.books = mappedBooks;
	} catch (error) {
		console.warn(
			`Failed details for ${beast.name}: ${error instanceof Error ? error.message : String(error)}`,
		);
		beast.subtitle = beast.subtitle ?? "";
		beast.description = beast.description ?? "";
		beast.skills = beast.skills ?? "";
		beast.talents = beast.talents ?? "";
		beast.abilities = beast.abilities ?? "";
		beast.equipment = beast.equipment ?? "";
		beast.books = beast.books ?? [];
	}
}

export async function fetchDetailsBeastData(): Promise<{
	items: BeastItem[];
	outputFile: string;
}> {
	const beastsFile = new URL("./list/beasts.json", import.meta.url).pathname;
	const booksFile = new URL("./list/books.json", import.meta.url).pathname;

	const [beastsText, booksText] = await Promise.all([
		Deno.readTextFile(beastsFile),
		Deno.readTextFile(booksFile),
	]);

	const beasts = JSON.parse(beastsText) as BeastItem[];
	const books = JSON.parse(booksText) as BookItem[];

	for (let start = 0; start < beasts.length; start += FETCH_BATCH_SIZE) {
		const batch = beasts.slice(start, start + FETCH_BATCH_SIZE);
		await Promise.all(batch.map((b) => enrichBeastDetail(b, books)));

		const processed = Math.min(start + FETCH_BATCH_SIZE, beasts.length);
		console.log(`Processed ${processed}/${beasts.length} beast details`);

		if (processed < beasts.length) {
			await sleep(FETCH_BATCH_DELAY_MS);
		}
	}

	await Deno.writeTextFile(beastsFile, JSON.stringify(beasts, null, 2));
	console.log(`Saved ${beasts.length} beast details to ${beastsFile}`);

	return { items: beasts, outputFile: beastsFile };
}

if (import.meta.main) {
	await fetchDetailsBeastData();
}
