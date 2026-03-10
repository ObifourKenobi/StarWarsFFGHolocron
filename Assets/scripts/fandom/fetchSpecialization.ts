import { logFound, writeJsonList } from "./util.ts";

const BASE_URL = "https://star-wars-rpg-ffg.fandom.com";
const CATEGORY_TITLE = "Category:Specialization";

interface SpecializationItem {
  name: string;
  sourceURL: string;
  sourceAPIURL: string;
}

async function fetchCategoryMembers(): Promise<SpecializationItem[]> {
  const items: SpecializationItem[] = [];
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
        sourceAPIURL:
          `${BASE_URL}/api.php?action=parse&page=${encodeURIComponent(title)}&format=json`,
      });
    }

    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue);

  const unique = new Map<string, SpecializationItem>();
  for (const item of items) {
    unique.set(item.name, item);
  }

  return Array.from(unique.values());
}

export async function fetchSpecializationData(): Promise<{
  items: SpecializationItem[];
  outputFile: string;
}> {
  const items = await fetchCategoryMembers();
  logFound(items.length, "specializations");

  const outputFile = await writeJsonList(
    import.meta.url,
    "specialization.json",
    items,
    "specializations",
  );

  return { items, outputFile };
}

if (import.meta.main) {
  await fetchSpecializationData();
}
