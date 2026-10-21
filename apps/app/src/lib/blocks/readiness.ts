import type { AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type DocumentReadiness,
	isRetryableFailure,
	type PipelineFailure,
	type PipelineStatus,
	type RepositoryReadiness,
} from "@orcai/schema";
import { and, asc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { reprocessAsset } from "@/lib/assets/processing";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { enqueueIndexing } from "@/lib/blocks/database-block";
import * as AppErrors from "@/lib/effect/utils/errors";

type PipelineRow = {
	processingStatus: PipelineStatus;
	processingFailure: PipelineFailure | null;
	indexStatus: PipelineStatus;
	indexFailure: PipelineFailure | null;
};

/** The one place that combines an asset's processing with its indexing in a repository. */
export const documentState = (
	row: PipelineRow,
): Pick<DocumentReadiness, "state" | "failure"> => {
	switch (row.processingStatus) {
		case "pending":
			return {
				state: "queued",
				failure: null,
			};
		case "active":
			return {
				state: "processing",
				failure: null,
			};
		case "failed":
			return {
				state: "failed",
				failure: {
					stage: "processing",
					kind: row.processingFailure ?? "other",
				},
			};
		case "completed":
			switch (row.indexStatus) {
				case "pending":
				case "active":
					return {
						state: "indexing",
						failure: null,
					};
				case "completed":
					return {
						state: "ready",
						failure: null,
					};
				case "failed":
					return {
						state: "failed",
						failure: {
							stage: "indexing",
							kind: row.indexFailure ?? "other",
						},
					};
			}
	}
};

export const readinessTotals = (
	documents: readonly Pick<DocumentReadiness, "state">[],
): RepositoryReadiness["totals"] => {
	const count = (states: readonly DocumentReadiness["state"][]) =>
		documents.filter((document) => states.includes(document.state)).length;
	return {
		total: documents.length,
		ready: count([
			"ready",
		]),
		preparing: count([
			"queued",
			"processing",
			"indexing",
		]),
		failed: count([
			"failed",
		]),
	};
};

/**
 * The readiness of each repository the user can read among `blockIds`, in
 * their order. Unreadable, missing and non-repository ids are left out.
 */
export const loadRepositoryReadiness = (params: {
	blockIds: readonly BlockId[];
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const blockIds = Array.from(new Set(params.blockIds));
		if (blockIds.length === 0) return [];
		const db = yield* DB;

		const capabilities = yield* getManyEntityCapabilities({
			entityType: "block",
			entityIds: blockIds,
			userId: params.userId,
			zedToken: params.zedToken,
		});
		const readableIds = blockIds.filter(
			(blockId) => capabilities.get(blockId)?.read === true,
		);
		if (readableIds.length === 0) return [];

		const [blocks, rows] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.block.id,
						name: dbSchema.block.name,
					})
					.from(dbSchema.block)
					.where(
						and(
							inArray(dbSchema.block.id, readableIds),
							eq(dbSchema.block.type, "database"),
						),
					),
				db
					.select({
						blockId: dbSchema.blockAsset.blockId,
						assetId: dbSchema.asset.id,
						title: dbSchema.asset.title,
						processingStatus: dbSchema.asset.processingStatus,
						processingFailure: dbSchema.asset.processingFailure,
						indexStatus: dbSchema.blockAsset.indexStatus,
						indexFailure: dbSchema.blockAsset.indexFailure,
					})
					.from(dbSchema.blockAsset)
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
					)
					.where(inArray(dbSchema.blockAsset.blockId, readableIds))
					.orderBy(asc(dbSchema.asset.title)),
			],
			{
				concurrency: "unbounded",
			},
		);

		const nameById = new Map(
			blocks.map((block) => [
				block.id,
				block.name,
			]),
		);

		return readableIds.flatMap((blockId): RepositoryReadiness[] => {
			const name = nameById.get(blockId);
			const blockCapabilities = capabilities.get(blockId);
			if (name === undefined || !blockCapabilities) return [];
			const documents = rows
				.filter((row) => row.blockId === blockId)
				.map(
					(row): DocumentReadiness => ({
						assetId: row.assetId,
						title: row.title,
						...documentState(row),
					}),
				);
			return [
				{
					blockId,
					name,
					capabilities: blockCapabilities,
					totals: readinessTotals(documents),
					documents,
				},
			];
		});
	});

/** The repository's documents with what a retry needs, optionally only some. */
const loadDocuments = (params: {
	blockId: BlockId;
	assetIds?: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				...getColumns(dbSchema.asset),
				indexStatus: dbSchema.blockAsset.indexStatus,
				indexFailure: dbSchema.blockAsset.indexFailure,
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(
				and(
					eq(dbSchema.blockAsset.blockId, params.blockId),
					params.assetIds
						? inArray(dbSchema.blockAsset.assetId, [
								...params.assetIds,
							])
						: undefined,
				),
			);
	});

type RetryDocument = Effect.Success<ReturnType<typeof loadDocuments>>[number];

const runRetries = (params: {
	blockId: BlockId;
	processing: readonly RetryDocument[];
	indexing: readonly RetryDocument[];
}) =>
	Effect.gen(function* () {
		// A document another request already queued is not admitted again.
		const admitted = yield* Effect.forEach(params.processing, reprocessAsset, {
			concurrency: 4,
		});
		yield* enqueueIndexing({
			blockId: params.blockId,
			assetIds: params.indexing.map((document) => document.id),
		});
		return {
			processing: admitted.filter(Boolean).length,
			indexing: params.indexing.length,
		};
	});

/**
 * Runs one document's stage again: processing when the file failed,
 * otherwise indexing in this repository. A document still being prepared has
 * nothing to retry.
 */
export const retryDocument = (params: { blockId: BlockId; assetId: AssetId }) =>
	Effect.gen(function* () {
		const [document] = yield* loadDocuments({
			blockId: params.blockId,
			assetIds: [
				params.assetId,
			],
		});
		if (!document) {
			return yield* new AppErrors.NotFoundError({
				reason: "ASSET_NOT_ATTACHED",
				message: "Asset not attached to this repository",
			});
		}

		const { state, failure } = documentState(document);
		const stage =
			state === "failed"
				? failure?.stage
				: state === "ready"
					? "indexing"
					: undefined;
		if (!stage) {
			return yield* new AppErrors.BadRequestError({
				reason: "DOCUMENT_STILL_PREPARING",
				message: "The document is still being prepared",
			});
		}

		const retried = yield* runRetries({
			blockId: params.blockId,
			processing:
				stage === "processing"
					? [
							document,
						]
					: [],
			indexing:
				stage === "indexing"
					? [
							document,
						]
					: [],
		});
		if (stage === "processing" && retried.processing === 0) {
			return yield* new AppErrors.BadRequestError({
				reason: "DOCUMENT_STILL_PREPARING",
				message: "The document is still being prepared",
			});
		}
		return {
			retried: stage,
		};
	});

/** Retries every failed document of the repository that retrying can help. */
export const retryFailedDocuments = (params: { blockId: BlockId }) =>
	Effect.gen(function* () {
		const failed = (yield* loadDocuments(params)).flatMap((document) => {
			const { failure } = documentState(document);
			return failure && isRetryableFailure(failure.kind)
				? [
						{
							document,
							stage: failure.stage,
						},
					]
				: [];
		});

		return yield* runRetries({
			blockId: params.blockId,
			processing: failed
				.filter((entry) => entry.stage === "processing")
				.map((entry) => entry.document),
			indexing: failed
				.filter((entry) => entry.stage === "indexing")
				.map((entry) => entry.document),
		});
	});
