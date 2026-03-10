import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";

export type BookItem = {
	code_name: string;
	book_name: string;
};

export type BookSourceItem = {
	code_name: string;
	book_name: string;
	page_number: string;
};

export function extractCellText(
	cell: Element,
	options: { removeQuotes?: boolean } = {},
): string {
	let text = cell.textContent ?? "";
	text = text.replace(/\u00a0/g, " ");
	text = text.replace(/\s*\[\d+\]\s*/g, " ");
	text = text.replace(/\s*\n\s*/g, " ");
	text = text.replace(/\s{2,}/g, " ").trim();
	if (options.removeQuotes) {
		text = text.replace(/"/g, "");
	}
	return text;
}

export function toInteger(value: string | number | undefined): number {
	if (typeof value === "number") {
		return Number.isFinite(value) ? Math.trunc(value) : 0;
	}
	if (!value) {
		return 0;
	}
	const cleaned = String(value).replace(/[^0-9-]/g, "");
	const num = parseInt(cleaned, 10);
	return Number.isNaN(num) ? 0 : num;
}

export function buildSourceInfoFromCell(
	cell: Element,
	baseUrl: string,
): { sourceURL: string; sourceAPIURL: string; pageName: string } {
	const link = cell.querySelector("a");
	const href = link?.getAttribute("href") ?? "";
	if (!href) {
		return { sourceURL: "", sourceAPIURL: "", pageName: "" };
	}

	const rawPageName = href.replace(/^\/wiki\//, "");
	const pageName = decodeURIComponent(rawPageName);
	const sourceURL = href.startsWith("http") ? href : `${baseUrl}${href}`;
	const sourceAPIURL = pageName
		? `${baseUrl}/api.php?action=parse&page=${encodeURIComponent(pageName)}&format=json`
		: "";

	return { sourceURL, sourceAPIURL, pageName };
}

export function logFound(count: number, label: string): void {
	console.log(`Found ${count} ${label}`);
}

export async function writeJsonList<T>(
	moduleUrl: string,
	fileName: string,
	items: T[],
	label: string,
): Promise<string> {
	const outputDir = new URL("./list", moduleUrl).pathname;
	await Deno.mkdir(outputDir, { recursive: true });

	const outputFile = `${outputDir}/${fileName}`;
	await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));
	console.log(`Saved ${items.length} ${label} to ${outputFile}`);
	return outputFile;
}

function normalizeBookTitle(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function cleanBookReferenceText(value: string): string {
	return value
		.replace(/\u00a0/g, " ")
		.replace(/\s*\[[0-9A-Za-z]+\]\s*/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeBookReferenceText(text: string): string {
	return cleanBookReferenceText(text)
		.replace(/\(\s*Page[^)]*\)/gi, "")
		.replace(/\s+-\s+Page\s+\d+.*/gi, "")
		.trim();
}

function extractPageNumber(text: string): string {
	const pageMatch = text.match(/\(\s*Pages?\s*([0-9]+)(?:\s*[-–]\s*[0-9]+)?\s*\)/i);
	if (pageMatch?.[1]) {
		return pageMatch[1];
	}

	const shortMatch = text.match(/\bp\.?\s*([0-9]+)(?:\s*[-–]\s*[0-9]+)?\b/i);
	if (shortMatch?.[1]) {
		return shortMatch[1];
	}

	return "";
}

function extractPageNumbers(text: string): string[] {
	const matches = Array.from(
		text.matchAll(/\(\s*Pages?\s*([0-9]+)(?:\s*[-–]\s*[0-9]+)?\s*\)/gi),
	);
	const pages = matches
		.map((match) => match[1] ?? "")
		.filter((page) => page.length > 0);

	if (pages.length > 0) {
		return pages;
	}

	const single = extractPageNumber(text);
	return single ? [single] : [""];
}

export function extractReferenceText(entry: Element): string {
	const ref = entry.querySelector(".reference-text") ?? entry;
	const html = ref.innerHTML.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "");
	const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	const wrapper = parsed?.querySelector("div");
	return cleanBookReferenceText(wrapper?.textContent ?? ref.textContent ?? "");
}

export function mapReferencesToBooks(
	scope: Element,
	books: BookItem[],
): BookSourceItem[] {
	const result = new Map<string, BookSourceItem>();
	const byCode = new Map(books.map((book) => [book.code_name.toUpperCase(), book]));
	const byTitle = new Map(books.map((book) => [normalizeBookTitle(book.book_name), book]));

	const referencesRoot =
		scope.querySelector(".mw-references-wrap .references") ??
		scope.querySelector(".references");

	if (!referencesRoot) {
		return [];
	}

	const entries = Array.from(referencesRoot.querySelectorAll("li"));

	for (const entry of entries) {
		const rawText = extractReferenceText(entry);
		const pageNumbers = extractPageNumbers(rawText);
		const text = normalizeBookReferenceText(rawText);
		if (!text) {
			continue;
		}

		const codes = text.match(/\b[A-Z]{3}\d{2}\b/g) ?? [];
		for (const code of codes) {
			const found = byCode.get(code.toUpperCase());
			if (found) {
				for (const pageNumber of pageNumbers) {
					const key = `${found.code_name}:${pageNumber || "-"}`;
					result.set(key, {
						code_name: found.code_name,
						book_name: found.book_name,
						page_number: pageNumber,
					});
				}
			}
		}

		const normalizedText = normalizeBookTitle(text);
		for (const [title, book] of byTitle.entries()) {
			if (normalizedText.includes(title)) {
				for (const pageNumber of pageNumbers) {
					const key = `${book.code_name}:${pageNumber || "-"}`;
					result.set(key, {
						code_name: book.code_name,
						book_name: book.book_name,
						page_number: pageNumber,
					});
				}
			}
		}
	}

	return Array.from(result.values());
}
