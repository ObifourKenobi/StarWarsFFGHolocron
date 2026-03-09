import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

async function inspectForcePower() {
  const url =
    "https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page=Category:Force_Power&format=json";
  const response = await fetch(url);
  const data = await response.json();
  const html = data.parse.text["*"];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (!doc) {
    throw new Error("Failed to parse HTML");
  }

  const scope = doc.querySelector(".mw-content-ltr.mw-parser-output");
  if (!scope) {
    throw new Error("Could not find content scope");
  }

  const tables = scope.querySelectorAll("table");
  console.log(`Found ${tables.length} tables`);

  const categoryContainer = scope.querySelector(".mw-category") ?? doc.querySelector(".mw-category");
  if (categoryContainer) {
    const categoryLinks = categoryContainer.querySelectorAll("a");
    console.log(`.mw-category links: ${categoryLinks.length}`);
    categoryLinks.slice(0, 5).forEach((link, idx) => {
      console.log(`  ${idx}: ${link.textContent?.trim()}`);
    });
  }

  const pagesContainer = scope.querySelector(".mw-pages") ?? doc.querySelector(".mw-pages");
  if (pagesContainer) {
    const pageLinks = pagesContainer.querySelectorAll("a");
    console.log(`.mw-pages links: ${pageLinks.length}`);
    pageLinks.slice(0, 5).forEach((link, idx) => {
      console.log(`  ${idx}: ${link.textContent?.trim()}`);
    });
  }

  const categoryGroups = scope.querySelectorAll(".mw-category-group");
  console.log(`.mw-category-group count: ${categoryGroups.length}`);
  for (let i = 0; i < Math.min(categoryGroups.length, 2); i++) {
    const group = categoryGroups[i];
    const label = group.querySelector("h3")?.textContent?.trim();
    const links = group.querySelectorAll("a");
    console.log(`  Group ${i + 1} ${label ?? ""}: ${links.length} links`);
    links.slice(0, 5).forEach((link, idx) => {
      console.log(`    ${idx}: ${link.textContent?.trim()}`);
    });
  }
}

await inspectForcePower();
