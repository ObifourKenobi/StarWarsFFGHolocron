// api page https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={PAGE_TITLE}&format=json
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { fetchFromfandomAPI, writeJsonList } from "./util.ts";

type BookItem = {
	code_name: string;
	book_name: string;
};

const SOURCE_URL: string = "https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Source_Book&format=json";

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

export async function fetchBooksData(): Promise<{ items: BookItem[]; outputFile: string }> {
	const html = await fetchFromfandomAPI(SOURCE_URL);
	const document = new DOMParser().parseFromString(html, "text/html");
	if (!document) {
		throw new Error("Failed to parse HTML response.");
	}

	const scope = document.querySelector(".mw-content-ltr.mw-parser-output") ?? document;
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

	const outputFile = await writeJsonList(
		import.meta.url,
		"books.json",
		deduped,
		"books",
	);

	return { items: deduped, outputFile };
}