import type { ActivityRunId, AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** A stage of one asset's background work; indexing is per repository. */
export type StageTarget =
	| {
			readonly stage: "processing" | "metadata";
			readonly assetId: AssetId;
			/** The repository a processing run indexes the asset in afterwards. */
			readonly blockId?: BlockId | null;
	  }
	| {
			readonly stage: "indexing";
			readonly assetId: AssetId;
			readonly blockId: BlockId;
	  };

const memberColumns = {
	processing: {
		state: "processingState",
		failureId: "processingFailureId",
	},
	metadata: {
		state: "metadataState",
		failureId: "metadataFailureId",
	},
	indexing: {
		state: "indexingState",
		failureId: "indexingFailureId",
	},
} as const;

/** The user who started the run, for a target's actor column; null for automatic work. */
export const runActor = (runId: ActivityRunId | undefined) =>
	runId
		? sql<UserId | null>`(select ${dbSchema.activityRun.userId} from ${dbSchema.activityRun} where ${dbSchema.activityRun.id} = ${runId})`
		: null;

/** A new id for a failure: every transition into failed is a new occurrence. */
export const newFailureId = sql<string>`gen_random_uuid()`;

const memberOf = (target: StageTarget) => {
	const { activityMember } = dbSchema;
	return and(
		eq(activityMember.assetId, target.assetId),
		target.stage === "indexing"
			? eq(activityMember.blockId, target.blockId)
			: undefined,
	);
};

/**
 * Records that `runId`, or automatic work, took over the targets' stage:
 * another run's pending stage on them is replaced, and `runId`'s member,
 * added when missing, turns pending. Call it in the transaction that admits
 * the targets, with only the targets it admitted. An indexing target counts
 * only for a member bound to its repository.
 */
export const admitStage = (
	runId: ActivityRunId | undefined,
	targets: readonly StageTarget[],
) =>
	Effect.gen(function* () {
		if (targets.length === 0) return;
		const db = yield* DB;
		const { activityMember } = dbSchema;
		const { stage } = targets[0];
		const columns = memberColumns[stage];
		const state = activityMember[columns.state];

		yield* db
			.update(activityMember)
			.set({
				[columns.state]: "replaced",
			})
			.where(
				and(
					or(...targets.map(memberOf)),
					eq(state, "pending"),
					runId ? ne(activityMember.runId, runId) : undefined,
				),
			);
		if (!runId) return;

		yield* db
			.insert(activityMember)
			.values(
				targets.map((target) => ({
					runId,
					assetId: target.assetId,
					blockId: target.blockId ?? null,
					[columns.state]: "pending" as const,
				})),
			)
			.onConflictDoUpdate({
				target: [
					activityMember.runId,
					activityMember.assetId,
				],
				targetWhere: sql`${activityMember.assetId} is not null`,
				set: {
					[columns.state]: "pending",
					[columns.failureId]: null,
				},
				setWhere:
					stage === "indexing"
						? sql`${activityMember.blockId} = excluded.block_id`
						: undefined,
			});
	});

/**
 * Ends the runs' pending indexing in the repositories, of `assetIds` or of
 * every asset, as replaced: the links go, so no delivery settles it. Call it
 * in the transaction that deletes the links or the repositories.
 */
export const replaceIndexing = (
	blockIds: readonly BlockId[],
	assetIds?: readonly AssetId[],
) =>
	Effect.gen(function* () {
		if (blockIds.length === 0 || assetIds?.length === 0) return;
		const db = yield* DB;
		const { activityMember } = dbSchema;
		yield* db
			.update(activityMember)
			.set({
				indexingState: "replaced",
			})
			.where(
				and(
					inArray(activityMember.blockId, blockIds),
					assetIds ? inArray(activityMember.assetId, assetIds) : undefined,
					eq(activityMember.indexingState, "pending"),
				),
			);
	});

/**
 * Records how the run's stage on the target ended. Call it only when the
 * attempt's fenced terminal write changed the target, in its transaction; a
 * member no longer pending was replaced and stays as it is.
 */
export const settleStage = (
	runId: ActivityRunId | undefined,
	target: StageTarget,
	outcome:
		| {
				readonly state: "completed";
		  }
		| {
				readonly state: "failed";
				readonly failureId: string | null;
		  },
) =>
	Effect.gen(function* () {
		if (!runId) return;
		const db = yield* DB;
		const { activityMember } = dbSchema;
		const columns = memberColumns[target.stage];
		yield* db
			.update(activityMember)
			.set({
				[columns.state]: outcome.state,
				[columns.failureId]:
					outcome.state === "failed" ? outcome.failureId : null,
			})
			.where(
				and(
					eq(activityMember.runId, runId),
					memberOf(target),
					eq(activityMember[columns.state], "pending"),
				),
			);
	});

/** The repository the run's member for the asset is bound to, if any. */
export const boundRepository = (
	runId: ActivityRunId | undefined,
	assetId: AssetId,
) =>
	Effect.gen(function* () {
		if (!runId) return undefined;
		const db = yield* DB;
		const { activityMember } = dbSchema;
		const [member] = yield* db
			.select({
				blockId: activityMember.blockId,
			})
			.from(activityMember)
			.where(
				and(
					eq(activityMember.runId, runId),
					eq(activityMember.assetId, assetId),
				),
			);
		return member?.blockId ?? undefined;
	});

/**
 * Whether the run still admits or does work: a call holds a live lease, a
 * member has a stage pending, or its export is in flight. Counts every
 * member, readable or not.
 */
export const runningRun = sql<boolean>`(
	exists (select 1 from ${dbSchema.activityAdmission} where ${dbSchema.activityAdmission.runId} = ${dbSchema.activityRun.id} and ${dbSchema.activityAdmission.leaseUntil} > now())
	or exists (select 1 from ${dbSchema.activityMember} where ${dbSchema.activityMember.runId} = ${dbSchema.activityRun.id} and 'pending' in (${dbSchema.activityMember.processingState}, ${dbSchema.activityMember.metadataState}, ${dbSchema.activityMember.indexingState}))
	or exists (select 1 from ${dbSchema.activityMember} inner join ${dbSchema.dataExport} on ${dbSchema.dataExport.id} = ${dbSchema.activityMember.dataExportId} where ${dbSchema.activityMember.runId} = ${dbSchema.activityRun.id} and ${dbSchema.dataExport.status} in ('pending', 'processing'))
)`;
