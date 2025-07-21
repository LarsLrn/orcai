import "dotenv/config";
import { db } from "../src/db/drizzle";
import {
	capabilityTable,
	modelCapabilityTable,
	modelTable,
	providerTable,
} from "../src/db/schema/model";
import { seedData, validateSeedData } from "./data/seed-data";

async function seed() {
	console.log("🌱 Starting database seeding...");

	try {
		// Validate seed data integrity first
		validateSeedData();

		// Seed capabilities first (no dependencies)
		console.log("📝 Seeding capabilities...");
		for (const capability of seedData.capabilities) {
			await db
				.insert(capabilityTable)
				.values(capability)
				.onConflictDoUpdate({
					target: capabilityTable.capability,
					set: {
						name: capability.name,
						description: capability.description,
					},
				});
		}

		// Seed providers
		console.log("🏢 Seeding providers...");
		for (const provider of seedData.providers) {
			await db
				.insert(providerTable)
				.values({
					slug: provider.slug,
					name: provider.name,
					description: provider.description,
					website: provider.website,
					compatibility: provider.compatibility,
					endpoint: provider.endpoint || null,
				})
				.onConflictDoUpdate({
					target: providerTable.slug,
					set: {
						name: provider.name,
						description: provider.description,
						website: provider.website,
						compatibility: provider.compatibility,
						endpoint: provider.endpoint || null,
						version: 1,
					},
				});
		}

		// Seed models
		console.log("🤖 Seeding models...");
		for (const model of seedData.models) {
			const { capabilities, ...modelData } = model;

			// Insert or update model
			const [insertedModel] = await db
				.insert(modelTable)
				.values(modelData)
				.onConflictDoUpdate({
					target: [modelTable.slug, modelTable.providerSlug],
					set: {
						name: modelData.name,
						description: modelData.description,
						isDeprecated: modelData.isDeprecated ?? false,
					},
				})
				.returning({ id: modelTable.id });

			// Link model capabilities
			for (const capability of capabilities) {
				await db
					.insert(modelCapabilityTable)
					.values({
						modelId: insertedModel.id,
						capability,
					})
					.onConflictDoNothing();
			}
		}

		console.log("✅ Database seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		process.exit(1);
	}
}

// Run the seed function
seed()
	.then(() => {
		console.log("🎉 Seeding finished!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Seeding failed:", error);
		process.exit(1);
	});
