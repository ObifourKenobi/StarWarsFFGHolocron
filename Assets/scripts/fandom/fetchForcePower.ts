const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const CATEGORY_TITLE = "Category:Force_Power";

interface ForcePowerItem {
	name: string;
	sourceURL: string;
	sourceAPIURL: string;
}

async function fetchCategoryMembers(): Promise<ForcePowerItem[]> {
	const items: ForcePowerItem[] = [];
	let cmcontinue: string | undefined;

	do {
		const params = new URLSearchParams({
			action: "query",
			format: "json",
			list: "categorymembers",
			cmtitle: CATEGORY_TITLE,
			cmlimit: "500",
		});

		if (cmcontinue) {
			params.set("cmcontinue", cmcontinue);
		}

		const url = `${BASE_URL}/api.php?${params.toString()}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch category members (${response.status})`);
		}

		const data = await response.json();
		const members = data?.query?.categorymembers ?? [];

		for (const member of members) {
			const title = String(member.title ?? "").trim();
			if (!title) continue;

			const pageTitle = title.replace(/ /g, "_");
			items.push({
				name: title,
				sourceURL: `${BASE_URL}/wiki/${encodeURIComponent(pageTitle)}`,
				sourceAPIURL: `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(title)}&format=json`,
			});
		}

		cmcontinue = data?.continue?.cmcontinue;
	} while (cmcontinue);

	return items;
}

export async function fetchForcePowerData(): Promise<{
	items: ForcePowerItem[];
	outputFile: string;
}> {
	const items = await fetchCategoryMembers();
	console.log(`Found ${items.length} force powers`);

	const outputDir = new URL("./list", import.meta.url).pathname;
	await Deno.mkdir(outputDir, { recursive: true });

	const outputFile = `${outputDir}/forcePowers.json`;
	await Deno.writeTextFile(outputFile, JSON.stringify(items, null, 2));

	console.log(`Saved ${items.length} force powers to ${outputFile}`);
	return { items, outputFile };
}

if (import.meta.main) {
	await fetchForcePowerData();
}
