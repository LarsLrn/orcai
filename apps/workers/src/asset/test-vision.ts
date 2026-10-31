import { afterAll } from "bun:test";
import { encryptApiKey } from "@orcai/ai";
import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createImageOnlyStoredExtractionArtifact } from "@orcai/process";
import { createQuotaPoolWithInitialPeriod } from "@orcai/quota";
import { sendPutObjectCommand } from "@orcai/s3/server";
import type { ModelCapability } from "@orcai/schema";
import { createOrganization, createUser } from "@orcai/testing";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** What the vision endpoint answers an image asset with. */
export const suggestion = {
	text: "A bar chart of refunds per month: January 4, February 7.",
	title: "Refunds per month",
	description: "A bar chart of refunds in January and February.",
	language: "en",
};

/** What the endpoint answers JSON mode with; a test may replace it, or cut it off at the budget. */
export const jsonAnswer: {
	value: unknown;
	cutOff?: boolean;
} = {
	value: suggestion,
};

/** What the endpoint received, newest last. */
export const requests: {
	responseFormat?: string;
	system: unknown;
	content: unknown;
}[] = [];

/** While set, the endpoint answers once it settles. */
export const held: {
	until?: Promise<unknown>;
} = {};

/** An OpenAI-compatible endpoint that answers JSON mode with `jsonAnswer` and text otherwise. */
const inference = serve({
	port: 0,
	fetch: async (request) => {
		const body = (await request.json()) as {
			model: string;
			response_format?: {
				type: string;
			};
			messages: {
				role: string;
				content: unknown;
			}[];
		};
		requests.push({
			responseFormat: body.response_format?.type,
			system: body.messages.find((message) => message.role === "system")
				?.content,
			content: body.messages.at(-1)?.content,
		});
		await held.until;
		return Response.json({
			id: "description",
			object: "chat.completion",
			created: 0,
			model: body.model,
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: jsonAnswer.cutOff
							? ""
							: body.response_format
								? JSON.stringify(jsonAnswer.value)
								: "A photo of a lighthouse.",
					},
					finish_reason: jsonAnswer.cutOff ? "length" : "stop",
				},
			],
			usage: {
				prompt_tokens: 100,
				completion_tokens: 20,
				total_tokens: 120,
			},
		});
	},
});
afterAll(() => inference.stop(true));

// A 1x1 transparent PNG.
export const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

/**
 * An organisation whose utility model has `capabilities`, a pool of `budget`
 * tokens for every member unless `pool` is false, and an uploaded asset of
 * `uploader`'s with its image stored.
 */
export const seedImageAsset = (params: {
	capabilities: ModelCapability[];
	pool?: boolean;
	budget?: number;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const admin = yield* createUser();
		const uploader = yield* createUser();
		const { organization } = yield* createOrganization({
			members: [
				{
					userId: admin.id,
					role: "admin",
				},
				{
					userId: uploader.id,
					role: "member",
				},
			],
		});
		const [provider] = yield* db
			.insert(dbSchema.provider)
			.values({
				organizationId: organization.id,
				name: "Vision provider",
				kind: "openai-compatible",
				description: "",
				endpoint: `${inference.url.origin}/v1`,
				apiKeyEncrypted: yield* encryptApiKey("integration-key"),
			})
			.returning();
		const [model] = yield* db
			.insert(dbSchema.model)
			.values({
				providerId: provider.id,
				providerModelId: "vision",
				name: "Vision",
				description: "",
				capabilities: params.capabilities,
			})
			.returning();
		yield* db
			.update(dbSchema.organization)
			.set({
				utilityModelId: model.id,
			})
			.where(eq(dbSchema.organization.id, organization.id));

		if (params.pool !== false) {
			const [allMembers] = yield* db
				.insert(dbSchema.group)
				.values({
					organizationId: organization.id,
					name: "All members",
					kind: "system",
					systemKey: "all_members",
					createdBy: admin.id,
				})
				.returning();
			yield* createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Utility pool",
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: params.budget ?? 100_000,
				priority: 0,
				isDefault: true,
				createdByUserId: admin.id,
				assignedGroupIds: [
					allMembers.id,
				],
			});
		}

		const [asset] = yield* db
			.insert(dbSchema.asset)
			.values({
				bucket: buckets.processed.name,
				prefix: `integration/${uploader.id}`,
				title: "chart.png",
				size: PNG.length,
				fileType: "png",
				userId: uploader.id,
			})
			.returning();
		yield* db.insert(dbSchema.resourceScope).values({
			resourceType: "asset",
			resourceId: asset.id,
			organizationId: organization.id,
			assignedBy: uploader.id,
		});
		const sourcePath = `${asset.prefix}/${asset.id}.png`;
		yield* sendPutObjectCommand({
			bucket: buckets.processed.name,
			key: sourcePath,
			body: PNG,
			contentType: "image/png",
		});

		return {
			organizationId: organization.id,
			adminId: admin.id,
			uploaderId: uploader.id,
			assetId: asset.id,
			prefix: asset.prefix,
			artifact: createImageOnlyStoredExtractionArtifact({
				mimeType: "image/png",
				format: "png",
				sourceBucket: buckets.processed.name,
				sourcePath,
			}),
		};
	});
