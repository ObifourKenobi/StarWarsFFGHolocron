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

	const pageName = href.replace(/^\/wiki\//, "");
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
