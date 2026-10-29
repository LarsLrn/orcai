import type {
	ActivityRunId,
	AssetId,
	BlockId,
	DataExportId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { runningRun } from "@orcai/pg-boss";
import type {
	ActivityMember,
	ActivityRun,
	ActivityRunState,
	ActivityStageState,
	DataExportStatus,
	PipelineStatus,
} from "@orcai/schema";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	isNull,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableIds } from "@/lib/authz/content-access";
import * as AppErrors from "@/lib/effect/utils/errors";

export type Viewer = {
	userId: UserId;
	zedToken: string | undefined;
};

const {
	activityMember,
	activityRun,
	asset,
	block,
	blockAsset,
	dataExport,
	member,
	organization,
} = dbSchema;

/** The user's runs they have not dismissed, of an organisation they still belong to or of none. */
export const visibleRuns = (userId: UserId) =>
	and(
		eq(activityRun.userId, userId),
		isNull(activityRun.dismissedAt),
		or(
			isNull(activityRun.organizationId),
			sql`exists (select 1 from ${member} where ${member.organizationId} = ${activityRun.organizationId} and ${member.userId} = ${userId})`,
		),
	);

const loadRuns = (where: SQL | undefined, limit?: number) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const query = db
			.select({
				id: activityRun.id,
				kind: activityRun.kind,
				createdAt: activityRun.createdAt,
				organizationId: activityRun.organizationId,
				organizationName: organization.name,
				blockId: activityRun.blockId,
				running: runningRun,
			})
			.from(activityRun)
			.leftJoin(organization, eq(organization.id, activityRun.organizationId))
			.where(where)
			.orderBy(desc(activityRun.createdAt), desc(activityRun.id));
		return yield* limit === undefined ? query : query.limit(limit);
	});

type RunRow = Effect.Success<ReturnType<typeof loadRuns>>[number];

const loadMembers = (runIds: readonly ActivityRunId[]) =>
	Effect.gen(function* () {
		if (runIds.length === 0) return [];
		const db = yield* DB;
		const laterReady = sql<boolean>`exists (
			select 1 from ${dataExport} later
			where later.user_id = ${dataExport.userId}
				and later.created_at > ${dataExport.createdAt}
				and later.status = 'ready'
		)`;
		return yield* db
			.select({
				runId: activityMember.runId,
				assetId: activityMember.assetId,
				blockId: activityMember.blockId,
				processingState: activityMember.processingState,
				metadataState: activityMember.metadataState,
				indexingState: activityMember.indexingState,
				appliedFields: activityMember.appliedFields,
				title: asset.title,
				processingStatus: asset.processingStatus,
				metadataStatus: asset.metadataStatus,
				indexStatus: blockAsset.indexStatus,
				dataExportId: activityMember.dataExportId,
				exportStatus: dataExport.status,
				exportExpiresAt: dataExport.expiresAt,
				exportReplaced: laterReady,
			})
			.from(activityMember)
			.leftJoin(asset, eq(asset.id, activityMember.assetId))
			.leftJoin(
				blockAsset,
				and(
					eq(blockAsset.assetId, activityMember.assetId),
					eq(blockAsset.blockId, activityMember.blockId),
				),
			)
			.leftJoin(dataExport, eq(dataExport.id, activityMember.dataExportId))
			.where(
				inArray(activityMember.runId, [
					...runIds,
				]),
			)
			.orderBy(asc(asset.title), asc(activityMember.id));
	});

type MemberRow = Effect.Success<ReturnType<typeof loadMembers>>[number];

/** The ids among the members' assets and repositories, and the runs' repositories, the viewer may read. */
const readableTargets = (
	runs: readonly RunRow[],
	members: readonly MemberRow[],
	viewer: Viewer,
) =>
	Effect.gen(function* () {
		const assetIds = [
			...new Set(
				members.flatMap((row) =>
					row.assetId
						? [
								row.assetId,
							]
						: [],
				),
			),
		];
		const blockIds = [
			...new Set([
				...members.flatMap((row) =>
					row.blockId
						? [
								row.blockId,
							]
						: [],
				),
				...runs.flatMap((run) =>
					run.blockId
						? [
								run.blockId,
							]
						: [],
				),
			]),
		];
		const [assets, blocks] = yield* Effect.all(
			[
				assetIds.length > 0
					? readableIds("asset", assetIds, viewer)
					: Effect.succeed(new Set<AssetId>()),
				blockIds.length > 0
					? readableIds("block", blockIds, viewer)
					: Effect.succeed(new Set<BlockId>()),
			],
			{
				concurrency: "unbounded",
			},
		);
		return {
			assets,
			blocks,
		};
	});

type Readable = Effect.Success<ReturnType<typeof readableTargets>>;

/** A member's stage as the viewer sees it, and whether its failure is repaired. */
type Stage = {
	state: ActivityStageState | null;
	target: PipelineStatus | null;
};

const stagesOf = (row: MemberRow, readable: Readable) => ({
	processing: {
		state: row.processingState,
		target: row.processingStatus,
	} satisfies Stage,
	metadata: {
		state: row.metadataState,
		target: row.metadataStatus,
	} satisfies Stage,
	indexing: {
		state:
			row.blockId && readable.blocks.has(row.blockId)
				? row.indexingState
				: null,
		target: row.indexStatus,
	} satisfies Stage,
});

const unresolved = (stage: Stage) =>
	stage.state === "failed" && stage.target !== "completed";

/** The asset members the viewer may read, with the stages they may see. */
const exposedMembers = (members: readonly MemberRow[], readable: Readable) =>
	members.flatMap((row) =>
		row.assetId && row.title !== null && readable.assets.has(row.assetId)
			? [
					{
						row,
						...stagesOf(row, readable),
						stages: Object.values(stagesOf(row, readable)),
					},
				]
			: [],
	);

const exportStatus = (row: MemberRow, now: Date): DataExportStatus | null =>
	row.exportStatus === "ready" &&
	row.exportExpiresAt !== null &&
	row.exportExpiresAt <= now
		? "expired"
		: row.exportStatus;

const exportState = (
	row: MemberRow,
	now: Date,
): ActivityRunState | undefined => {
	switch (exportStatus(row, now)) {
		case "pending":
		case "processing":
			return "running";
		case "failed":
			return row.exportReplaced ? "resolved" : "failed";
		case "expired":
			return "expired";
		case "ready":
			return "finished";
		default:
			return undefined;
	}
};

const toRun = (
	run: RunRow,
	members: readonly MemberRow[],
	readable: Readable,
	repositoryNames: ReadonlyMap<BlockId, string>,
	now: Date,
): ActivityRun => {
	const exposed = exposedMembers(members, readable);
	const exported = members.find((row) => row.dataExportId !== null);
	const stages = exposed.flatMap((member) => member.stages);
	const failed = exposed.filter((member) => member.stages.some(unresolved));
	const state: ActivityRunState = exported
		? (exportState(exported, now) ?? "finished")
		: run.running
			? "running"
			: failed.length > 0
				? "failed"
				: stages.some((stage) => stage.state === "failed")
					? "resolved"
					: "finished";
	const applied = exposed.flatMap(({ row }) =>
		row.appliedFields
			? [
					row.appliedFields,
				]
			: [],
	);
	const repositoryName = run.blockId
		? repositoryNames.get(run.blockId)
		: undefined;
	const [only] = exposed;

	return {
		id: run.id,
		kind: run.kind,
		state,
		createdAt: run.createdAt,
		organization:
			run.organizationId && run.organizationName !== null
				? {
						id: run.organizationId,
						name: run.organizationName,
					}
				: null,
		repository:
			run.blockId &&
			repositoryName !== undefined &&
			readable.blocks.has(run.blockId)
				? {
						id: run.blockId,
						name: repositoryName,
					}
				: null,
		asset:
			exposed.length === 1 && only?.row.assetId && only.row.title !== null
				? {
						id: only.row.assetId,
						title: only.row.title,
					}
				: null,
		progress: {
			total: exposed.length,
			done: exposed.filter(
				(member) => !member.stages.some((stage) => stage.state === "pending"),
			).length,
			failed: failed.length,
		},
		metadata:
			run.kind === "fill_metadata"
				? {
						updated: applied.filter((fields) => fields.length > 0).length,
						unchanged: applied.filter((fields) => fields.length === 0).length,
					}
				: null,
		dataExport:
			exported?.dataExportId && exported.exportStatus
				? {
						id: exported.dataExportId as DataExportId,
						status: exportStatus(exported, now) ?? exported.exportStatus,
					}
				: null,
	};
};

const repositoryNames = (blockIds: ReadonlySet<BlockId>) =>
	Effect.gen(function* () {
		if (blockIds.size === 0) return new Map<BlockId, string>();
		const db = yield* DB;
		const rows = yield* db
			.select({
				id: block.id,
				name: block.name,
			})
			.from(block)
			.where(
				inArray(block.id, [
					...blockIds,
				]),
			);
		return new Map(
			rows.map((row) => [
				row.id,
				row.name,
			]),
		);
	});

const describeRuns = (runs: readonly RunRow[], viewer: Viewer) =>
	Effect.gen(function* () {
		const members = yield* loadMembers(runs.map((run) => run.id));
		const readable = yield* readableTargets(runs, members, viewer);
		const names = yield* repositoryNames(readable.blocks);
		const now = new Date();
		return runs.map((run) =>
			toRun(
				run,
				members.filter((row) => row.runId === run.id),
				readable,
				names,
				now,
			),
		);
	});

/** The viewer's runs still running, for the polled summary. */
export const runningRuns = (viewer: Viewer) =>
	Effect.gen(function* () {
		const runs = yield* loadRuns(and(visibleRuns(viewer.userId), runningRun));
		return yield* describeRuns(runs, viewer);
	});

/** The viewer's runs, newest first: a page before `before`, or the ones in `ids`. */
export const listRuns = (
	viewer: Viewer,
	params: {
		before?: ActivityRunId;
		limit: number;
		ids?: readonly ActivityRunId[];
	},
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const cursor = params.before
			? (yield* db
					.select({
						createdAt: activityRun.createdAt,
						id: activityRun.id,
					})
					.from(activityRun)
					.where(
						and(
							eq(activityRun.id, params.before),
							eq(activityRun.userId, viewer.userId),
						),
					))[0]
			: undefined;
		if (params.before && !cursor) {
			return {
				data: [],
				hasMore: false,
			};
		}
		const runs = yield* loadRuns(
			and(
				visibleRuns(viewer.userId),
				params.ids
					? inArray(activityRun.id, [
							...params.ids,
						])
					: undefined,
				cursor
					? or(
							lt(activityRun.createdAt, cursor.createdAt),
							and(
								eq(activityRun.createdAt, cursor.createdAt),
								lt(activityRun.id, cursor.id),
							),
						)
					: undefined,
			),
			params.limit + 1,
		);
		return {
			data: yield* describeRuns(runs.slice(0, params.limit), viewer),
			hasMore: runs.length > params.limit,
		};
	});

const findVisibleRun = (runId: ActivityRunId, userId: UserId) =>
	Effect.gen(function* () {
		const [run] = yield* loadRuns(
			and(eq(activityRun.id, runId), visibleRuns(userId)),
		);
		if (!run) {
			return yield* new AppErrors.NotFoundError({
				reason: "ACTIVITY_RUN_NOT_FOUND",
				message: "Activity run not found",
			});
		}
		return run;
	});

/** A page of the run's assets the viewer may read, and how many got each field. */
export const listRunMembers = (
	viewer: Viewer,
	params: {
		runId: ActivityRunId;
		pageIndex: number;
		pageSize: number;
	},
) =>
	Effect.gen(function* () {
		const run = yield* findVisibleRun(params.runId, viewer.userId);
		const members = yield* loadMembers([
			run.id,
		]);
		const readable = yield* readableTargets(
			[
				run,
			],
			members,
			viewer,
		);
		const exposed = exposedMembers(members, readable);
		const fields: Record<string, number> = {};
		for (const { row } of exposed) {
			for (const field of row.appliedFields ?? []) {
				fields[field] = (fields[field] ?? 0) + 1;
			}
		}
		const start = params.pageIndex * params.pageSize;
		return {
			data: exposed.slice(start, start + params.pageSize).map(
				(member): ActivityMember => ({
					asset: {
						id: member.row.assetId as AssetId,
						title: member.row.title as string,
					},
					processing: member.processing.state,
					metadata: member.metadata.state,
					indexing: member.indexing.state,
					appliedFields: member.row.appliedFields,
				}),
			),
			rowCount: exposed.length,
			fields,
		};
	});

/** Hides a finished run of the viewer's; a running one stays. */
export const dismissRun = (runId: ActivityRunId, userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const run = yield* findVisibleRun(runId, userId);
		if (run.running) {
			return yield* new AppErrors.BadRequestError({
				reason: "ACTIVITY_RUN_RUNNING",
				message: "A running activity cannot be dismissed",
			});
		}
		yield* db
			.update(activityRun)
			.set({
				dismissedAt: new Date(),
			})
			.where(and(eq(activityRun.id, run.id), eq(activityRun.userId, userId)));
	});
