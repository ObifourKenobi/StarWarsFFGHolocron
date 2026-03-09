import { fetchBooksData } from "./fetchBook.ts";
import { fetchArmorData } from "./fetchArmor.ts";
import { fetchSpeciesData } from "./fetchSpecies.ts";
import { fetchVehiclesData } from "./fetchVehicle.ts";
import { fetchShipsData } from "./fetchShip.ts";

type FetchResult = { outputFile: string };

async function listAll(): Promise<void> {
	await fetchBooksData();
	await fetchArmorData();
	await fetchSpeciesData();
	await fetchVehiclesData();
	await fetchShipsData();
}

function getArgValue(flag: string): string | undefined {
	const index = Deno.args.indexOf(flag);
	if (index === -1) {
		return undefined;
	}
	return Deno.args[index + 1];
}

async function run(): Promise<void> {
	if (Deno.args.includes("--all")) {
		await listAll();
		return;
	}

	const type = getArgValue("--type");
	if (!type) {
		console.error("Missing --type argument.");
		Deno.exit(1);
	}

	let result: FetchResult | undefined;

	switch (type) {
		case "books":
			result = await fetchBooksData();
			break;
		case "armor":
			result = await fetchArmorData();
			break;
		case "species":
			result = await fetchSpeciesData();
			break;
		case "vehicles":
			result = await fetchVehiclesData();
			break;
		case "ships":
			result = await fetchShipsData();
			break;
		default:
			console.error(
				`Unsupported type: ${type}. Supported: books, armor, species, vehicles, ships.`,
			);
			Deno.exit(1);
	}

	if (result) {
		console.log(`Wrote ${result.outputFile}`);
	}
}

await run();

// if script run with --all then run all the fetch sub typescript file