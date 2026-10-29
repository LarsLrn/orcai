import { afterAll, beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import type { AssetId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { StoredExtractionArtifact } from "@orcai/process";
import { S3Live } from "@orcai/s3/server";
import { IntegrationLive } from "@orcai/testing";
import { like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { describeImages } from "@/asset/image-descriptions";
import { AssetPipelineError } from "@/asset/pipeline-attempt";
import { requests, seedImageAsset, suggestion } from "@/asset/test-vision";

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

beforeEach(() => {
	requests.length = 0;
});

const seed = (params: Parameters<typeof seedImageAsset>[0]) =>
	run(seedImageAsset(params));

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

test("a quota that refuses the call fails an image asset and a document with quota", async () => {
	const { assetId, artifact } = await seed({
		capabilities: [
			"text",
			"image",
		],
		pool: false,
	});

	expect(await failureOf(describe(assetId, artifact, true))).toBe("quota");
	expect(
		await failureOf(
			describe(
				assetId,
				asFigures(artifact, [
					undefined,
				]),
				false,
			),
		),
	).toBe("quota");
	expect(requests).toHaveLength(0);
});
