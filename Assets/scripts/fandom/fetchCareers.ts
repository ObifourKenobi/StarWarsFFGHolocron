import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

interface Career {
	name: string;
	sourceURL: string;
	sourceAPIURL: string;
}

const CATEGORY_URL = "https://star-wars-rpg-ffg.fandom.com/wiki/Category:Careers";
const API_URL = "https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Careers&format=json";

async function fetchCareers(): Promise<Career[]> {
	console.log(`Fetching careers from ${CATEGORY_URL}...`);

	const response = await fetch(API_URL);
	const data = await response.json();
	const html = data.parse.text["*"];

	const document = new DOMParser().parseFromString(html, "text/html");
	if (!document) {
		throw new Error("Failed to parse HTML");
	}

	// Target the content section
	const contentSection = document.querySelector(".mw-content-ltr.mw-parser-output");
	if (!contentSection) {
		throw new Error("Could not find content section");
	}

	const careers: Career[] = [];

	// Find all UL elements in the content section
	const ulElements = contentSection.querySelectorAll("ul");
	
	for (const ul of ulElements) {
		// Skip UL elements inside TOC
		let parent = ul.parentElement;
		let isInToc = false;
		while (parent) {
			const id = parent.getAttribute("id");
			const className = parent.getAttribute("class");
			if (id === "toc" || className?.includes("toc")) {
				isInToc = true;
				break;
			}
			parent = parent.parentElement;
		}
		
		if (isInToc) {
			continue;
		}
		
		// Find all LI elements with links
		const liElements = ul.querySelectorAll("li");
		
		for (const li of liElements) {
			const link = li.querySelector("a");
			if (link) {
				const href = link.getAttribute("href");
				const name = link.textContent?.trim();
				
				if (href && name) {
					// Convert relative URL to absolute
					const fullURL = href.startsWith("http") 
						? href 
						: `https://star-wars-rpg-ffg.fandom.com${href}`;
					
					// Extract page name from URL for API
					const pageName = href.replace("/wiki/", "");
					const apiURL = `https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=${pageName}&format=json`;
					
					careers.push({
						name,
						sourceURL: fullURL,
						sourceAPIURL: apiURL,
					});
				}
			}
		}
	}
	return careers;
}

export async function saveCareers() {
	const careers = await fetchCareers();
	
	const outputPath = "./list/careers.json";
	await Deno.writeTextFile(
		outputPath,
		JSON.stringify(careers, null, 2)
	);
}

if (import.meta.main) {
	await saveCareers();
}
