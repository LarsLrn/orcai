import { afterAll, beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive, encryptApiKey } from "@orcai/ai";
import { type AssetId, buckets, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createImageOnlyStoredExtractionArtifact,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { createQuotaPoolWithInitialPeriod } from "@orcai/quota";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import type { ModelCapability } from "@orcai/schema";
import {
	createOrganization,
	createUser,
	IntegrationLive,
} from "@orcai/testing";
import { serve } from "bun";
import { eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { describeImages } from "@/asset/image-descriptions";
import { AssetPipelineError } from "@/asset/pipeline-failure";

const runtime = ManagedRuntime.make(
	Layer.mergeAll(IntegrationLive, S3Live, EncryptionKeyLive),
);
afterAll(() => runtime.dispose());

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

const suggestion = {
	text: "A bar chart of refunds per month: January 4, February 7.",
	title: "Refunds per month",
	description: "A bar chart of refunds in January and February.",
	language: "en",
};

/** What the endpoint received, newest last. */
const requests: {
	responseFormat?: string;
	content: unknown;
}[] = [];

/** An OpenAI-compatible endpoint that answers JSON mode with `suggestion` and text otherwise. */
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
			content: body.messages.at(-1)?.content,
		});
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
						content: body.response_format
							? JSON.stringify(suggestion)
							: "A photo of a lighthouse.",
					},
					finish_reason: "stop",
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

beforeEach(() => {
	requests.length = 0;
});

// A 1x1 transparent PNG.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

/**
 * An organisation whose utility model has `capabilities`, a pool for every
 * member unless `pool` is false, and an uploaded asset of `uploader`'s with
 * its image stored.
 */
const seed = (params: { capabilities: ModelCapability[]; pool?: boolean }) =>
	run(
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
					budgetAmount: 100_000,
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
				uploaderId: uploader.id,
				assetId: asset.id,
				artifact: createImageOnlyStoredExtractionArtifact({
					mimeType: "image/png",
					format: "png",
					sourceBucket: buckets.processed.name,
					sourcePath,
				}),
			};
		}),
	);

/** The same stored image as a figure of a document. */
const asFigures = (
	artifact: StoredExtractionArtifact,
	texts: (string | null | undefined)[],
): StoredExtractionArtifact => ({
	...artifact,
	content: "A document about refunds.",
	images: texts.map((text, imageIndex) => ({
		...artifact.images[0],
		imageIndex,
		...(text !== undefined && {
			text,
		}),
	})),
});

const describe = (
	assetId: AssetId,
	artifact: StoredExtractionArtifact,
	imageAsset: boolean,
) =>
	run(
		describeImages({
			assetId,
			jobId: crypto.randomUUID(),
			artifact,
			imageAsset,
		}),
	);

const usageOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select({
					organizationId: dbSchema.quotaUsageEvent.organizationId,
					userId: dbSchema.quotaUsageEvent.userId,
					eventType: dbSchema.quotaUsageEvent.eventType,
				})
				.from(dbSchema.quotaUsageEvent)
				.where(
					like(dbSchema.quotaUsageEvent.appRequestId, `image:${assetId}:%`),
				);
		}),
	);

const failureOf = async (promise: Promise<unknown>) => {
	const error = await promise.then(
		() => undefined,
		(cause: unknown) => cause,
	);
	return error instanceof AssetPipelineError ? error.failure : error;
};

test("an image asset is described in one call, charged to its organisation and uploader", async () => {
	const { assetId, artifact, organizationId, uploaderId } = await seed({
		capabilities: [
			"text",
			"image",
		],
	});

	const described = await describe(assetId, artifact, true);

	expect(described.images[0]?.text).toBe(suggestion.text);
	expect(described.metadataSuggestion).toEqual({
		title: suggestion.title,
		description: suggestion.description,
		language: suggestion.language,
	});
	expect(requests).toHaveLength(1);
	expect(requests[0]?.responseFormat).toBe("json_object");
	expect(JSON.stringify(requests[0]?.content)).toContain("image_url");
	expect(await usageOf(assetId)).toContainEqual({
		organizationId,
		userId: uploaderId as UserId,
		eventType: "finalized",
	});
});

test("figures already described are kept; only the others are described", async () => {
	const { assetId, artifact } = await seed({
		capabilities: [
			"text",
			"image",
		],
	});

	const described = await describe(
		assetId,
		asFigures(artifact, [
			"A described figure.",
			null,
			undefined,
		]),
		false,
	);

	expect(described.images.map((image) => image.text)).toEqual([
		"A described figure.",
		null,
		"A photo of a lighthouse.",
	]);
	expect(requests).toHaveLength(1);
	expect(requests[0]?.responseFormat).toBeUndefined();
});

test("without a utility model that reads images, an image asset is unsupported and figures are skipped", async () => {
	const { assetId, artifact } = await seed({
		capabilities: [
			"text",
		],
	});

	expect(await failureOf(describe(assetId, artifact, true))).toBe(
		"unsupported",
	);

	const described = await describe(
		assetId,
		asFigures(artifact, [
			undefined,
		]),
		false,
	);
	expect(described.images.map((image) => image.text)).toEqual([
		null,
	]);
	expect(requests).toHaveLength(0);
});
