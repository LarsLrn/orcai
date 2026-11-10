import { beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import type { AssetId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { AssetPipelineError } from "@orcai/preparation";
import type { ExtractionArtifact } from "@orcai/process";
import { QuotaReservationsLive } from "@orcai/quota";
import { S3Live } from "@orcai/s3/server";
import { integrationRuntime } from "@orcai/testing";
import { like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describeImages, imageReader } from "@/asset/image-descriptions";
import { requests, seedVisionAsset, suggestion } from "@/asset/test-vision";

const { runPromise: run } = integrationRuntime(
	Layer.mergeAll(S3Live, QuotaReservationsLive, EncryptionKeyLive),
);

beforeEach(() => {
	requests.length = 0;
});

const seed = (params: Parameters<typeof seedVisionAsset>[0]) =>
	run(seedVisionAsset(params));

/** The same stored image as `count` figures of a document. */
const asFigures = (
	artifact: ExtractionArtifact,
	count: number,
): ExtractionArtifact => ({
	...artifact,
	content: "A document about refunds.",
	images: Array.from(
		{
			length: count,
		},
		(_, imageIndex) => ({
			...artifact.images[0],
			imageIndex,
		}),
	),
});

const describe = (
	assetId: AssetId,
	artifact: ExtractionArtifact,
	imageAsset: boolean,
) =>
	run(
		describeImages({
			assetId,
			jobId: crypto.randomUUID(),
			artifact,
			imageAsset,
			reader: imageReader(assetId),
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

test("every figure is described, in the uploader's language", async () => {
	const { assetId, artifact } = await seed({
		capabilities: [
			"text",
			"image",
		],
		locale: "de",
	});

	const described = await describe(assetId, asFigures(artifact, 2), false);

	expect(described.images.map((image) => image.text)).toEqual([
		"A photo of a lighthouse.",
		"A photo of a lighthouse.",
	]);
	expect(requests).toHaveLength(2);
	for (const request of requests) {
		expect(request.responseFormat).toBeUndefined();
		expect(request.system).toContain("in German, the uploader's language");
	}
});

/** The text a request sent before its image. */
const contextOf = (request: (typeof requests)[number]) =>
	(
		request.content as {
			type: string;
			text?: string;
		}[]
	)
		.flatMap((part) =>
			part.type === "text" && part.text
				? [
						part.text,
					]
				: [],
		)
		.join("");

test("a figure is described with the document's title, its caption and the text of its page", async () => {
	const { assetId, artifact } = await seed({
		capabilities: [
			"text",
			"image",
		],
	});
	const [image] = artifact.images;
	if (!image) throw new Error("The seeded asset has no image.");
	const document: ExtractionArtifact = {
		...artifact,
		content: "A document about refunds.",
		metadata: {
			...artifact.metadata,
			title: "Refunds in 2025",
		},
		pages: [
			{
				pageNumber: 2,
				content: "Figure 1 shows refunds per month at the Leeds office.",
			},
		],
		images: [
			{
				...image,
				imageIndex: 0,
				pageNumber: 2,
			},
			{
				...image,
				imageIndex: 1,
				pageNumber: 9,
				description: "Refunds per month",
			},
		],
	};

	await describe(assetId, document, false);

	expect(requests.map(contextOf).sort()).toEqual([
		"<document_title>\nchart.png\nRefunds in 2025\n</document_title>\n\n<caption>\nRefunds per month\n</caption>",
		"<document_title>\nchart.png\nRefunds in 2025\n</document_title>\n\n<page_text>\nFigure 1 shows refunds per month at the Leeds office.\n</page_text>",
	]);
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

	const described = await describe(assetId, asFigures(artifact, 1), false);
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
		await failureOf(describe(assetId, asFigures(artifact, 1), false)),
	).toBe("quota");
	expect(requests).toHaveLength(0);
});
