// api page https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={PAGE_TITLE}&format=json
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

type BookItem = {
	code_name: string;
	book_name: string;
};

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const PAGE_TITLE = "Category:Source_Book";
const CONTENT_SELECTOR = ".mw-content-ltr.mw-parser-output";
const OUTPUT_FILE_NAME = "books.json";

function parseCodeName(text: string): string | null {
	const match = text.match(/\[([^\]]+)\]/);
	return match ? match[1].trim() : null;
}

function extractBookName(paragraph: Element): string {
	const firstTextNode = [...paragraph.childNodes].find((node) => node.nodeType === 3);
	const firstText = (firstTextNode?.textContent ?? "").trim();

	if (firstText !== "") {
		return firstText
			.replace(/^\s*\[[^\]]+\]\s*/, "")
			.replace(/\s*-\s*$/, "")
			.trim();
	}

	const fullText = (paragraph.textContent ?? "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\s*\[[^\]]+\]\s*/, "");

	return fullText.split(" - ")[0].trim();
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

export async function fetchBooksData(): Promise<{ items: BookItem[]; outputFile: string }> {
	const html = await fetchHtml();
	const document = new DOMParser().parseFromString(html, "text/html");
	if (!document) {
		throw new Error("Failed to parse HTML response.");
	}

	const scope = document.querySelector(CONTENT_SELECTOR) ?? document;
	const paragraphs = [...scope.querySelectorAll("p")];

	const items: BookItem[] = [];
	for (const paragraph of paragraphs) {
		const text = (paragraph.textContent ?? "").replace(/\s+/g, " ").trim();
		const code_name = parseCodeName(text);
		if (!code_name) {
			continue;
		}

		const book_name = extractBookName(paragraph);
		if (book_name === "") {
			continue;
		}

		items.push({ code_name, book_name });
	}

	const deduped = [...new Map(items.map((item) => [item.code_name, item])).values()];
	console.log(`Found ${deduped.length} books`);

	const outputDir = join(dirname(fromFileUrl(import.meta.url)), "list");
	await Deno.mkdir(outputDir, { recursive: true });
	const outputFile = join(outputDir, OUTPUT_FILE_NAME);
	await Deno.writeTextFile(outputFile, JSON.stringify(deduped, null, 2));
	console.log(`Saved ${deduped.length} books to ${outputFile}`);

	return { items: deduped, outputFile };
}