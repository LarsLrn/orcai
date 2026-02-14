import fs from "node:fs";
import path from "node:path";
import { v1 } from "@authzed/authzed-node";

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
				`⚠️ Unknown SPICEDB_SECURITY="${mode}", defaulting to insecure-plaintext`,
			);
			return v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS;
	}
}

async function deploySchema() {
	try {
		console.log("🚀 Starting SpiceDB schema deployment...");
		const endpoint = process.env.SPICEDB_ENDPOINT || "localhost:50051";
		const token = process.env.SPICEDB_TOKEN || "test";
		const security = resolveClientSecurity();
		console.log(`🔌 Connecting to SpiceDB at ${endpoint}`);
		console.log(`🔐 Security mode: ${v1.ClientSecurity[security]}`);

		// Create SpiceDB client
		const { promises: client } = v1.NewClient(token, endpoint, security);

		// Read the schema file
		const schemaPath = path.resolve("./src/lib/spice-db/schema.zed");
		console.log(`📖 Reading schema from: ${schemaPath}`);

		if (!fs.existsSync(schemaPath)) {
			throw new Error(`Schema file not found at: ${schemaPath}`);
		}

		const schemaContent = fs.readFileSync(schemaPath, "utf8");
		console.log(`✅ Schema loaded (${schemaContent.length} characters)`);

		// Write the schema
		const schemaRequest = v1.WriteSchemaRequest.create({
			schema: schemaContent,
		});

		console.log("📤 Deploying schema to SpiceDB...");
		const response = await client.writeSchema(schemaRequest);

		console.log("✅ Schema deployed successfully!");
		console.log("Response:", response);

		// Optionally verify the schema was written correctly
		console.log("🔍 Verifying schema deployment...");
		const readResponse = await client.readSchema(
			v1.ReadSchemaRequest.create({}),
		);
		console.log("✅ Schema verification complete");
		console.log(
			`📋 Current schema version: ${readResponse.schemaText.length} characters`,
		);
	} catch (error) {
		console.error("❌ Error deploying SpiceDB schema:", error);
		process.exit(1);
	}
}

// Run the deployment
await deploySchema();
