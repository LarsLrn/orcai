import type { BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	DocumentReadiness,
	PipelineFailure,
	PipelineStatus,
	RepositoryReadiness,
} from "@orcai/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";

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
