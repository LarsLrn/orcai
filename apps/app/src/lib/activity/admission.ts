import type {
	ActivityRunId,
	AssetId,
	BlockId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import type { ActivityRunKind, ResourceType } from "@orcai/schema";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** How long an upload call keeps its run open without renewing, by the database clock. */
const leaseEnd = sql<Date>`now() + interval '10 minutes'`;

/** The organisation a resource is home to, as a subquery for a run's label. */
export const homeOrganization = (resourceType: ResourceType, id: string) => {
	const { resourceScope } = dbSchema;
	return sql<OrganizationId | null>`(
		select ${resourceScope.organizationId} from ${resourceScope}
		where ${resourceScope.resourceType} = ${resourceType}
			and ${resourceScope.resourceId} = ${id}
			and ${resourceScope.isPrimary}
			and ${resourceScope.endedAt} is null
		limit 1
	)`;
};

/**
 * Runs `admit` as the work of a new run of the user's, in one transaction.
 * A run that admitted nothing is not kept, and a deadlocked transaction runs
 * again, so `admit` must be safe to re-run.
 */
export const inActivityRun = <A, E, R>(
	run: {
		userId: UserId;
		kind: Exclude<ActivityRunKind, "upload">;
		organizationId?: OrganizationId | ReturnType<typeof homeOrganization>;
		blockId?: BlockId;
	},
	admit: (runId: ActivityRunId) => Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, activityRun } = dbSchema;
		return yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const [created] = yield* db
						.insert(activityRun)
						.values(run)
						.returning({
							id: activityRun.id,
						});
					if (!created) {
						return yield* Effect.die(new Error("Activity run not created"));
					}
					const admitted = yield* admit(created.id);
					yield* db
						.delete(activityRun)
						.where(
							and(
								eq(activityRun.id, created.id),
								sql`not exists (select 1 from ${activityMember} where ${activityMember.runId} = ${created.id})`,
							),
						);
					return admitted;
				}),
			),
		);
	});

/**
 * The user's upload run for `clientKey`, or a new one, with a lease for this
 * call that keeps it open. Undefined when the key names a run of another
 * kind or organisation.
 */
export const openUploadRun = (params: {
	userId: UserId;
	organizationId: OrganizationId;
	clientKey?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityAdmission, activityRun } = dbSchema;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const [run] = yield* db
					.insert(activityRun)
					.values({
						userId: params.userId,
						kind: "upload",
						organizationId: params.organizationId,
						clientKey: params.clientKey,
					})
					.onConflictDoUpdate({
						target: [
							activityRun.userId,
							activityRun.clientKey,
						],
						set: {
							dismissedAt: null,
							finishedSeenAt: null,
						},
						setWhere: and(
							eq(activityRun.kind, "upload"),
							eq(activityRun.organizationId, params.organizationId),
						),
					})
					.returning({
						id: activityRun.id,
					});
				if (!run) return undefined;
				const [lease] = yield* db
					.insert(activityAdmission)
					.values({
						runId: run.id,
						leaseUntil: leaseEnd,
					})
					.returning({
						id: activityAdmission.id,
					});
				if (!lease) return undefined;
				return {
					runId: run.id,
					leaseId: lease.id,
				};
			}),
		);
	});

/** Keeps the call's lease alive while it admits more files. */
export const renewAdmission = (leaseId: string) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* db
			.update(dbSchema.activityAdmission)
			.set({
				leaseUntil: leaseEnd,
			})
			.where(eq(dbSchema.activityAdmission.id, leaseId));
	});

/** Ends the call's lease; the run stays open while other calls hold one. */
export const releaseAdmission = (leaseId: string) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* db
			.delete(dbSchema.activityAdmission)
			.where(eq(dbSchema.activityAdmission.id, leaseId));
	});

/**
 * Records that the run took on the asset without work of its own: a repeated
 * upload of an asset that already exists.
 */
export const addActivityMember = (runId: ActivityRunId, assetId: AssetId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* db
			.insert(dbSchema.activityMember)
			.values({
				runId,
				assetId,
			})
			.onConflictDoNothing();
	});

/**
 * Binds the user's upload runs among `runIds` to the repository, when it is
 * home to the run's organisation and the run has no other repository, and
 * binds their members among the newly linked assets to it. Returns the run
 * each bound asset belongs to; its indexing there is that run's work. Call
 * it in the transaction that links the assets, so processing completing
 * after it carries the run on.
 */
export const bindUploadRuns = (params: {
	userId: UserId;
	runIds: readonly ActivityRunId[];
	blockId: BlockId;
	assetIds: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		if (params.runIds.length === 0 || params.assetIds.length === 0) {
			return new Map<AssetId, ActivityRunId>();
		}
		const db = yield* DB;
		const { activityMember, activityRun } = dbSchema;
		const runs = yield* db
			.update(activityRun)
			.set({
				blockId: params.blockId,
			})
			.where(
				and(
					inArray(activityRun.id, [
						...params.runIds,
					]),
					eq(activityRun.userId, params.userId),
					eq(activityRun.kind, "upload"),
					eq(
						activityRun.organizationId,
						homeOrganization("block", params.blockId),
					),
					or(
						isNull(activityRun.blockId),
						eq(activityRun.blockId, params.blockId),
					),
				),
			)
			.returning({
				id: activityRun.id,
			});
		if (runs.length === 0) return new Map<AssetId, ActivityRunId>();

		const bound = yield* db
			.update(activityMember)
			.set({
				blockId: params.blockId,
			})
			.where(
				and(
					inArray(
						activityMember.runId,
						runs.map((run) => run.id),
					),
					inArray(activityMember.assetId, [
						...params.assetIds,
					]),
					or(
						isNull(activityMember.blockId),
						eq(activityMember.blockId, params.blockId),
					),
				),
			)
			.returning({
				runId: activityMember.runId,
				assetId: activityMember.assetId,
			});
		return new Map(
			bound.flatMap((member) =>
				member.assetId
					? [
							[
								member.assetId,
								member.runId,
							] as const,
						]
					: [],
			),
		);
	});
