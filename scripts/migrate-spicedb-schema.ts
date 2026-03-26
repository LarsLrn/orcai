import path from "node:path";
import { v1 } from "@authzed/authzed-node";
import { runConvergeStatus, runConvergeUp } from "./spice-converge/runner";

const TARGET_SCHEMA_PATH = path.resolve("./src/lib/spice-db/schema.zed");

function resolveClientSecurity(): v1.ClientSecurity {
	const mode = (process.env.SPICEDB_SECURITY ?? "insecure-plaintext")
		.toLowerCase()
		.trim();

	switch (mode) {
		case "secure":
			return v1.ClientSecurity.SECURE;
		case "insecure-localhost":
			return v1.ClientSecurity.INSECURE_LOCALHOST_ALLOWED;
		case "insecure-plaintext":
			return v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS;
		default:
			console.warn(
				`Unknown SPICEDB_SECURITY="${mode}". Falling back to insecure-plaintext`,
			);
			return v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS;
	}
}

async function main() {
	const command = process.argv[2] ?? "up";
	const endpoint = process.env.SPICEDB_ENDPOINT || "localhost:50051";
	const token = process.env.SPICEDB_TOKEN || "test";
	const security = resolveClientSecurity();
	const { promises: spice } = v1.NewClient(token, endpoint, security);

	if (command === "status") {
		await runConvergeStatus({
			spice,
			targetSchemaPath: TARGET_SCHEMA_PATH,
		});
		return;
	}

	if (command === "dry-run") {
		await runConvergeUp({
			spice,
			targetSchemaPath: TARGET_SCHEMA_PATH,
			dryRun: true,
		});
		return;
	}

	if (command === "up") {
		await runConvergeUp({
			spice,
			targetSchemaPath: TARGET_SCHEMA_PATH,
		});
		return;
	}

	throw new Error(
		`Unknown command '${command}'. Use one of: up, status, dry-run`,
	);
}

await main().catch((error) => {
	console.error("SpiceDB migration failed:", error);
	process.exit(1);
});
