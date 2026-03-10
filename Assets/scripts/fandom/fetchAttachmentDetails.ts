import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import { BookItem, BookSourceItem, mapReferencesToBooks } from "./util.ts";

type AttachmentItem = {
	name: string;
	hardPoints: number;
	encumbrance: number;
	restricted: boolean;
	price: string;
	rarity: string;
	sourceURL: string;
	sourceAPIURL: string;
	subtitle?: string;
	description?: string;
	"Models Include"?: string;
	"Base Modifiers"?: string;
	"Modification Options"?: string;
	books?: BookSourceItem[];
};

const EXCLUDED_TEXT =
	"More information about the attachment available on the Wookieepedia article.";
const FETCH_BATCH_SIZE = 20;
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
	return /(?:Models Include|Base Modifiers|Modification Options)\s*:/i.test(text);
}

/**
 * Extract a labeled field from a paragraph containing multiple bold-labeled sections.
 * Example: "Models Include: ..., ... Base Modifiers: ... Modification Options: ..."
 */
function extractField(text: string, label: string): string {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`${escaped}\\s*:\\s*(.*?)(?=\\s*(?:Models Include|Base Modifiers|Modification Options)\\s*:|$)`,
		"is",
	);
	return text.match(pattern)?.[1]?.trim() ?? "";
}

/**
 * Parse subtitle, description, and labeled attachment fields from the page scope.
 * - subtitle: first valid paragraph
 * - description: remaining unlabeled paragraphs + any <pre> blocks
 * - Models Include / Base Modifiers / Modification Options: from labeled paragraph
 */
function pickAttachmentContent(scope: Element): {
	subtitle: string;
	description: string;
	modelsInclude: string;
	baseModifiers: string;
	modificationOptions: string;
} {
	const paragraphs = Array.from(scope.querySelectorAll("p"));
	const preBlocks = Array.from(scope.querySelectorAll("pre"));

	let subtitle = "";
	const descParts: string[] = [];
	let modelsInclude = "";
	let baseModifiers = "";
	let modificationOptions = "";

	for (const p of paragraphs) {
		if (isImageOnlyParagraph(p)) continue;
		const text = getCleanText(p);
		if (!text || text === EXCLUDED_TEXT) continue;

		if (!subtitle) {
			subtitle = text;
			continue;
		}

		if (isLabeledParagraph(text)) {
			modelsInclude = extractField(text, "Models Include");
			baseModifiers = extractField(text, "Base Modifiers");
			modificationOptions = extractField(text, "Modification Options");
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
		modelsInclude,
		baseModifiers,
		modificationOptions,
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

async function enrichAttachmentDetail(
	attachment: AttachmentItem,
	books: BookItem[],
): Promise<void> {
	if (!attachment.sourceAPIURL) {
		attachment.subtitle = attachment.subtitle ?? "";
		attachment.description = attachment.description ?? "";
		attachment["Models Include"] = attachment["Models Include"] ?? "";
		attachment["Base Modifiers"] = attachment["Base Modifiers"] ?? "";
		attachment["Modification Options"] = attachment["Modification Options"] ?? "";
		attachment.books = attachment.books ?? [];
		return;
	}

	try {
		const html = await fetchPageHtml(attachment.sourceAPIURL);
		const doc = new DOMParser().parseFromString(html, "text/html");
		if (!doc) throw new Error("Failed to parse HTML");

		const scope =
			doc.querySelector(".mw-content-ltr.mw-parser-output") ??
			doc.querySelector(".mw-parser-output") ??
			doc;

		const { subtitle, description, modelsInclude, baseModifiers, modificationOptions } =
			pickAttachmentContent(scope);
		const mappedBooks = mapReferencesToBooks(scope, books);

		attachment.subtitle = subtitle;
		attachment.description = description;
		attachment["Models Include"] = modelsInclude;
		attachment["Base Modifiers"] = baseModifiers;
		attachment["Modification Options"] = modificationOptions;
		attachment.books = mappedBooks;
	} catch (error) {
		console.warn(
			`Failed details for ${attachment.name}: ${error instanceof Error ? error.message : String(error)}`,
		);
		attachment.subtitle = attachment.subtitle ?? "";
		attachment.description = attachment.description ?? "";
		attachment["Models Include"] = attachment["Models Include"] ?? "";
		attachment["Base Modifiers"] = attachment["Base Modifiers"] ?? "";
		attachment["Modification Options"] = attachment["Modification Options"] ?? "";
		attachment.books = attachment.books ?? [];
	}
}

export async function fetchDetailsAttachmentData(): Promise<{
	items: AttachmentItem[];
	outputFile: string;
}> {
	const attachmentsFile = new URL("./list/attachments.json", import.meta.url).pathname;
	const booksFile = new URL("./list/books.json", import.meta.url).pathname;

	const [attachmentsText, booksText] = await Promise.all([
		Deno.readTextFile(attachmentsFile),
		Deno.readTextFile(booksFile),
	]);

	const attachments = JSON.parse(attachmentsText) as AttachmentItem[];
	const books = JSON.parse(booksText) as BookItem[];

	for (let start = 0; start < attachments.length; start += FETCH_BATCH_SIZE) {
		const batch = attachments.slice(start, start + FETCH_BATCH_SIZE);
		await Promise.all(batch.map((a) => enrichAttachmentDetail(a, books)));

		const processed = Math.min(start + FETCH_BATCH_SIZE, attachments.length);
		console.log(`Processed ${processed}/${attachments.length} attachment details`);

		if (processed < attachments.length) {
			await sleep(FETCH_BATCH_DELAY_MS);
		}
	}

	await Deno.writeTextFile(attachmentsFile, JSON.stringify(attachments, null, 2));
	console.log(`Saved ${attachments.length} attachment details to ${attachmentsFile}`);

	return { items: attachments, outputFile: attachmentsFile };
}

if (import.meta.main) {
	await fetchDetailsAttachmentData();
}
