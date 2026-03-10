import { fetchBooksData } from "./fetchBook.ts";
import { fetchArmorData } from "./fetchArmor.ts";
import { fetchAttachmentData } from "./fetchAttachment.ts";
import { fetchGearData } from "./fetchGear.ts";
import { fetchDroidData } from "./fetchDroid.ts";
import { fetchBeastData } from "./fetchBeast.ts";
import { fetchCareersData } from "./fetchCareers.ts";
import { fetchForcePowerData } from "./fetchForcePower.ts";
import { fetchQualityData } from "./fetchQuality.ts";
import { fetchSpeciesData } from "./fetchSpecies.ts";
import { fetchVehiclesData } from "./fetchVehicle.ts";
import { fetchShipsData } from "./fetchShip.ts";
import { fetchWeaponData } from "./fetchWeapon.ts";

type FetchResult = { outputFile: string };

async function listAll(): Promise<void> {
	await fetchBooksData();
	await fetchArmorData();
	await fetchAttachmentData();
	await fetchGearData();
	await fetchDroidData();
	await fetchBeastData();
	await fetchCareersData();
	await fetchForcePowerData();
	await fetchQualityData();
	await fetchSpeciesData();
	await fetchVehiclesData();
	await fetchShipsData();
	await fetchWeaponData();
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
		case "attachment":
			result = await fetchAttachmentData();
			break;
		case "gear":
			result = await fetchGearData();
			break;
		case "droid":
			result = await fetchDroidData();
			break;
		case "beast":
			result = await fetchBeastData();
			break;
		case "careers":
			result = await fetchCareersData();
			break;
		case "forcepower":
			result = await fetchForcePowerData();
			break;
		case "qualities":
			result = await fetchQualityData();
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
		case "weapons":
			result = await fetchWeaponData();
			break;
		default:
			console.error(
				`Unsupported type: ${type}. Supported: books, armor, attachment, gear, droid, beast, careers, forcepower, qualities, species, vehicles, ships, weapons.`,
			);
			Deno.exit(1);
	}

	if (result) {
		console.log(`Wrote ${result.outputFile}`);
	}
}

await run();

// if script run with --all then run all the fetch sub typescript file