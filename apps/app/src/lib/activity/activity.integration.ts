import { describe, expect, test } from "bun:test";
import {
	type ActivityRunId,
	type AssetId,
	buckets,
	type OrganizationId,
} from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	admitStage,
	newFailureId,
	queueAfterProcessing,
	queueIndexing,
	settleStage,
} from "@orcai/pg-boss";
import { awaitLockWaiters } from "@orcai/testing";
import { and, eq, sql } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Tracer from "effect/Tracer";
import {
	addActivityMember,
	homeOrganization,
	inActivityRun,
	openUploadRun,
	releaseAdmission,
	renewAdmission,
} from "@/lib/activity/admission";
import { activitySummary } from "@/lib/activity/summary";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { deleteOrganizationsWithAuthorization } from "@/lib/authz/organization-lifecycle";
import { writeRelationships } from "@/lib/authz/relationship-write";
import {
	deleteResourcesWithAuthorization,
	initializeResourceAuthorization,
} from "@/lib/authz/resource-lifecycle";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const procedures = () => run(Procedures);

/** An owner and a member of one fresh organisation. */
const organization = async () => {
	const {
		organizationId,
		actors: [owner, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	return {
		organizationId,
		owner: owner as Actor,
		member: member as Actor,
		zedToken,
	};
};

const setProcessing = (
	assetId: AssetId,
	status: "completed" | "failed",
	failureId: string | null = null,
) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					processingStatus: status,
					processingFailure: status === "failed" ? "extraction" : null,
					processingFailureId: failureId,
				})
				.where(eq(dbSchema.asset.id, assetId));
		}),
	);

/** What a processing delivery of `runId` writes when it ends, as the worker's fenced write does. */
const endProcessing = (
	assetId: AssetId,
	runId: ActivityRunId | undefined,
	outcome: "completed" | "failed",
) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db.transaction(() =>
				Effect.gen(function* () {
					const [written] = yield* db
						.update(dbSchema.asset)
						.set({
							processingStatus: outcome,
							processingFailure: outcome === "failed" ? "extraction" : null,
							processingFailureId: outcome === "failed" ? newFailureId : null,
						})
						.where(
							and(
								eq(dbSchema.asset.id, assetId),
								sql`${dbSchema.asset.processingStatus} in ('pending', 'active')`,
							),
						)
						.returning({
							failureId: dbSchema.asset.processingFailureId,
						});
					if (!written) throw new Error("No processing attempt to end");
					yield* settleStage(
						runId,
						{
							stage: "processing",
							assetId,
						},
						outcome === "failed"
							? {
									state: "failed",
									failureId: written.failureId,
								}
							: {
									state: "completed",
								},
					);
					return written.failureId;
				}),
			);
		}),
	);

const prepareAgain = async (
	actor: Actor,
	assetId: AssetId,
	zedToken?: string,
) => {
	await run(
		(await procedures()).asset.prepareAgain(
			{
				id: assetId,
			},
			await procedureOptions(actor, zedToken),
		),
	);
	const { running } = await summary(actor, zedToken);
	const started = running.find((entry) => entry.asset?.id === assetId);
	if (!started) throw new Error("Preparing again started no run");
	return started.id;
};

const summary = async (actor: Actor, zedToken?: string) =>
	run(
		(await procedures()).activity.summary(
			{},
			await procedureOptions(actor, zedToken),
		),
	);

const runsOf = async (actor: Actor, ids?: ActivityRunId[], zedToken?: string) =>
	(
		await run(
			(
				await procedures()
			).activity.runs(
				{
					limit: 50,
					ids,
				},
				await procedureOptions(actor, zedToken),
			),
		)
	).data;

const attentionOf = async (actor: Actor, zedToken?: string) =>
	run(
		(await procedures()).activity.attention(
			{},
			await procedureOptions(actor, zedToken),
		),
	);

const stateOf = async (actor: Actor, runId: ActivityRunId, zedToken?: string) =>
	(
		await runsOf(
			actor,
			[
				runId,
			],
			zedToken,
		)
	)[0]?.state;

describe("activity runs", () => {
	test(
		"a retry runs, fails into attention, and resolves once a later run completes the stage",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			const legacy = crypto.randomUUID();
			await setProcessing(asset.id, "failed", legacy);

			// A failure from before activity belongs to the uploader.
			expect((await attentionOf(owner, zedToken)).failures).toEqual([
				expect.objectContaining({
					occurrenceId: legacy,
					stage: "processing",
					failure: "extraction",
					asset: {
						id: asset.id,
						title: asset.title,
					},
				}),
			]);

			const first = await prepareAgain(owner, asset.id, zedToken);
			expect(await summary(owner, zedToken)).toMatchObject({
				running: [
					{
						id: first,
						kind: "retry",
						state: "running",
						organization: {
							id: organizationId,
						},
						progress: {
							total: 1,
							done: 0,
							failed: 0,
						},
					},
				],
				attention: {
					failures: 0,
				},
			});

			const failure = await endProcessing(asset.id, first, "failed");
			expect((await summary(owner, zedToken)).running).toEqual([]);
			expect(await stateOf(owner, first, zedToken)).toBe("failed");
			expect((await attentionOf(owner, zedToken)).failures).toEqual([
				expect.objectContaining({
					occurrenceId: failure,
				}),
			]);

			const second = await prepareAgain(owner, asset.id, zedToken);
			expect(await stateOf(owner, first, zedToken)).toBe("failed");
			await endProcessing(asset.id, second, "completed");
			expect(await stateOf(owner, first, zedToken)).toBe("resolved");
			expect(await stateOf(owner, second, zedToken)).toBe("finished");
			expect((await attentionOf(owner, zedToken)).failures).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"another user's run ids and failures reveal nothing",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const stranger = await organization();
			const created = await createAsset(owner, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			await setProcessing(asset.id, "completed");
			const runId = await prepareAgain(owner, asset.id, zedToken);
			const failure = await endProcessing(asset.id, runId, "failed");
			const p = await procedures();
			const options = await procedureOptions(stranger.owner, stranger.zedToken);

			expect(
				await runsOf(
					stranger.owner,
					[
						runId,
					],
					stranger.zedToken,
				),
			).toEqual([]);
			await expect(
				run(
					p.activity.runMembers(
						{
							runId,
							pageIndex: 0,
							pageSize: 10,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ACTIVITY_RUN_NOT_FOUND",
			});
			await expect(
				run(
					p.activity.dismissRun(
						{
							runId,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ACTIVITY_RUN_NOT_FOUND",
			});
			await expect(
				run(
					p.activity.dismissFailure(
						{
							occurrenceId: failure as string,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ACTIVITY_FAILURE_NOT_FOUND",
			});
			const listed = await run(
				p.asset.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							runId,
						},
					},
					options,
				),
			);
			expect(listed.rowCount).toBe(0);

			// The owner still sees it all.
			expect((await attentionOf(owner, zedToken)).failures).toHaveLength(1);
			const own = await run(
				p.asset.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							runId,
						},
					},
					await procedureOptions(owner, zedToken),
				),
			);
			expect(own.data.map((row) => row.id)).toEqual([
				asset.id,
			]);
		},
		TIMEOUT,
	);

	test(
		"a revoked grant takes the asset out of the run's progress and attention",
		async () => {
			const {
				organizationId,
				owner,
				member,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			await setProcessing(asset.id, "completed");
			const p = await procedures();
			const granted = await run(
				p.resource.grant(
					{
						resourceType: "asset",
						resourceId: asset.id,
						role: "editor",
						principals: [
							{
								principalType: "user",
								principalId: member.user.id,
							},
						],
					},
					await procedureOptions(owner, zedToken),
				),
			);
			const token = granted.meta?.zedToken ?? zedToken;
			const runId = await prepareAgain(member, asset.id, token);
			await endProcessing(asset.id, runId, "failed");
			expect((await attentionOf(member, token)).failures).toHaveLength(1);
			// The failure of work the member asked for is theirs, not the uploader's.
			expect((await attentionOf(owner, token)).failures).toEqual([]);

			const revoked = await run(
				p.resource.revoke(
					{
						resourceType: "asset",
						resourceId: asset.id,
						principalType: "user",
						principalId: member.user.id,
					},
					await procedureOptions(owner, token),
				),
			);
			const after = revoked.meta?.zedToken ?? token;
			expect((await attentionOf(member, after)).failures).toEqual([]);
			expect(
				(
					await runsOf(
						member,
						[
							runId,
						],
						after,
					)
				)[0],
			).toMatchObject({
				state: "finished",
				asset: null,
				progress: {
					total: 0,
					done: 0,
					failed: 0,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"leaving the organisation hides its runs and the uploads' failures",
		async () => {
			const {
				organizationId,
				owner,
				member,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(member, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			await setProcessing(asset.id, "completed");
			const runId = await prepareAgain(member, asset.id, zedToken);
			await endProcessing(asset.id, runId, "failed");
			expect(
				await runsOf(
					member,
					[
						runId,
					],
					zedToken,
				),
			).toHaveLength(1);

			const removed = await run(
				(await procedures()).organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await procedureOptions(owner, zedToken),
				),
			);
			const token = removed.meta?.zedToken ?? zedToken;
			expect(
				await runsOf(
					member,
					[
						runId,
					],
					token,
				),
			).toEqual([]);
			expect((await attentionOf(member, token)).failures).toEqual([]);
			const listed = await run(
				(await procedures()).asset.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							runId,
						},
					},
					await procedureOptions(member, token),
				),
			);
			expect(listed.rowCount).toBe(0);
		},
		TIMEOUT,
	);

	test(
		"a deleted asset leaves its runs and attention",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			await setProcessing(asset.id, "completed");
			const runId = await prepareAgain(owner, asset.id, zedToken);
			await endProcessing(asset.id, runId, "failed");
			// A second asset keeps the run from being empty, which the cleanup would delete.
			const kept = await createAsset(owner, organizationId);
			await run(addActivityMember(runId, kept.asset.id));

			const p = await procedures();
			const deleted = await run(
				p.asset.delete(
					{
						refs: [
							{
								id: asset.id,
							},
						],
					},
					await procedureOptions(owner, kept.zedToken ?? zedToken),
				),
			);
			const token = deleted.meta?.zedToken ?? kept.zedToken ?? zedToken;
			expect((await attentionOf(owner, token)).failures).toEqual([]);
			expect(
				(
					await runsOf(
						owner,
						[
							runId,
						],
						token,
					)
				)[0],
			).toMatchObject({
				state: "finished",
				asset: {
					id: kept.asset.id,
				},
				progress: {
					total: 1,
					done: 1,
					failed: 0,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"a dismissed failure stays hidden until the next failure, and only a finished run can be dismissed",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const { asset } = created;
			const zedToken = created.zedToken ?? organizationToken;
			await setProcessing(asset.id, "completed");
			const p = await procedures();
			const options = await procedureOptions(owner, zedToken);
			const first = await prepareAgain(owner, asset.id, zedToken);
			await expect(
				run(
					p.activity.dismissRun(
						{
							runId: first,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ACTIVITY_RUN_RUNNING",
			});
			const failure = await endProcessing(asset.id, first, "failed");
			const before = (await summary(owner, zedToken)).attention;
			await run(
				p.activity.dismissFailure(
					{
						occurrenceId: failure as string,
					},
					options,
				),
			);
			expect((await attentionOf(owner, zedToken)).failures).toEqual([]);
			await run(
				p.activity.dismissRun(
					{
						runId: first,
					},
					options,
				),
			);
			expect(
				await runsOf(
					owner,
					[
						first,
					],
					zedToken,
				),
			).toEqual([]);

			const second = await prepareAgain(owner, asset.id, zedToken);
			const again = await endProcessing(asset.id, second, "failed");
			expect(again).not.toBe(failure);
			expect((await attentionOf(owner, zedToken)).failures).toEqual([
				expect.objectContaining({
					occurrenceId: again,
				}),
			]);
			// Same count, another failure: the revision tells them apart.
			const after = (await summary(owner, zedToken)).attention;
			expect(after.failures).toBe(before.failures);
			expect(after.revision).not.toBe(before.revision);
		},
		TIMEOUT,
	);
});

/** Ends the run's live leases now, as if the calls holding them had crashed long ago. */
const lapseLeases = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.activityAdmission)
				.set({
					leaseUntil: sql`now() - interval '1 second'`,
				})
				.where(eq(dbSchema.activityAdmission.runId, runId));
		}),
	);

describe("upload admission leases", () => {
	/** A call's lease on the upload run for `clientKey`, which holds a repeated upload, so it is not empty. */
	const open = async (
		actor: Actor,
		organizationId: OrganizationId,
		clientKey: string,
	) => {
		const admission = await run(
			openUploadRun({
				userId: actor.user.id,
				organizationId,
				clientKey,
			}),
		);
		if (!admission) throw new Error("No upload run");
		const { asset } = await createAsset(actor, organizationId);
		await run(addActivityMember(admission.runId, asset.id));
		return admission;
	};

	test(
		"overlapping calls share the run, which runs until the last one releases",
		async () => {
			const { organizationId, owner, zedToken } = await organization();
			const key = crypto.randomUUID();
			const first = await open(owner, organizationId, key);
			const second = await open(owner, organizationId, key);
			expect(second.runId).toBe(first.runId);

			await run(releaseAdmission(first.leaseId));
			expect(await stateOf(owner, first.runId)).toBe("running");
			await run(releaseAdmission(second.leaseId));
			expect(await stateOf(owner, first.runId)).toBe("finished");
			expect(zedToken).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"a crashed call's lease runs out, and a renewing call keeps the run open past its first lease",
		async () => {
			const { organizationId, owner } = await organization();
			const crashed = await open(owner, organizationId, crypto.randomUUID());
			await lapseLeases(crashed.runId);
			expect(await stateOf(owner, crashed.runId)).toBe("finished");

			const working = await open(owner, organizationId, crypto.randomUUID());
			await lapseLeases(working.runId);
			await run(renewAdmission(working.leaseId));
			expect(await stateOf(owner, working.runId)).toBe("running");
		},
		TIMEOUT,
	);

	test(
		"a key of another organisation's upload opens no run",
		async () => {
			const { organizationId, owner } = await organization();
			const other = await run(
				Effect.gen(function* () {
					const [row] = yield* (yield* DB)
						.select({
							id: dbSchema.organization.id,
						})
						.from(dbSchema.organization)
						.where(sql`${dbSchema.organization.id} <> ${organizationId}`)
						.limit(1);
					return row?.id;
				}),
			);
			const key = crypto.randomUUID();
			await open(owner, organizationId, key);
			expect(
				await run(
					openUploadRun({
						userId: owner.user.id,
						organizationId: other as OrganizationId,
						clientKey: key,
					}),
				),
			).toBeUndefined();
		},
		TIMEOUT,
	);
});

/** Runs `effect` and counts the SQL statements it sends and their largest parameter list. */
const traced = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
	const statements: string[] = [];
	const tracer = Tracer.make({
		span(options) {
			const span = new Tracer.NativeSpan(options);
			const attribute = span.attribute.bind(span);
			span.attribute = (key, value) => {
				if (key === "db.query.text") statements.push(String(value));
				attribute(key, value);
			};
			return span;
		},
	});
	return effect.pipe(
		Effect.withTracer(tracer),
		Effect.map((value) => ({
			value,
			statements,
		})),
	);
};

const largestParameterList = (statements: readonly string[]) =>
	Math.max(
		0,
		...statements.map((text) =>
			Math.max(
				0,
				...[
					...text.matchAll(/\$(\d+)/g),
				].map((match) => Number(match[1])),
			),
		),
	);

describe("activity summary cost", () => {
	test(
		"a retained 1000-asset backfill and 200 failures cost a bounded summary that never carries the finished run's assets",
		async () => {
			const { organizationId, owner, zedToken } = await organization();
			const { backfill, failed, token } = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const insertAssets = (count: number, failures: boolean) =>
						db
							.insert(dbSchema.asset)
							.values(
								Array.from(
									{
										length: count,
									},
									(_, index) => ({
										title: `Scale ${index}`,
										size: 1,
										fileType: "pdf" as const,
										bucket: buckets.main.name,
										prefix: `users/${owner.user.id}/asset`,
										userId: owner.user.id,
										processingStatus: failures
											? ("failed" as const)
											: ("completed" as const),
										processingFailure: failures ? ("other" as const) : null,
										processingFailureId: failures ? newFailureId : null,
									}),
								),
							)
							.returning({
								id: dbSchema.asset.id,
							});
					const { result, zedToken: token } = yield* writeRelationships(
						{
							organizationIds: [
								organizationId,
							],
						},
						Effect.gen(function* () {
							const backfill = yield* insertAssets(1000, false);
							const failed = yield* insertAssets(200, true);
							yield* Effect.forEach(
								[
									...backfill,
									...failed,
								],
								(row) =>
									initializeResourceAuthorization({
										resource: {
											resourceType: "asset",
											resourceId: row.id,
										},
										organizationId,
										ownerUserId: owner.user.id,
									}),
								{
									discard: true,
								},
							);
							return {
								backfill,
								failed,
							};
						}),
					);
					const [created] = yield* db
						.insert(dbSchema.activityRun)
						.values({
							userId: owner.user.id,
							kind: "fill_metadata",
							organizationId,
						})
						.returning({
							id: dbSchema.activityRun.id,
						});
					yield* db.insert(dbSchema.activityMember).values(
						result.backfill.map((row) => ({
							runId: created.id,
							assetId: row.id,
							metadataState: "completed" as const,
							appliedFields: [
								"description" as const,
							],
						})),
					);
					return {
						...result,
						token,
					};
				}),
			);
			expect(backfill).toHaveLength(1000);

			const { value, statements } = await run(
				traced(
					activitySummary({
						userId: owner.user.id,
						zedToken: token ?? zedToken,
					}),
				),
			);
			expect(value.running).toEqual([]);
			expect(value.attention.failures).toBe(failed.length);
			// Runs, three attention candidate reads and one committed-readability check.
			expect(statements.length).toBeLessThanOrEqual(5);
			expect(largestParameterList(statements)).toBeLessThan(backfill.length);
		},
		TIMEOUT,
	);
});

const repository = (assets: AssetId[], uploadRunIds: ActivityRunId[]) => ({
	type: "database" as const,
	name: "Activity repository",
	description: null,
	contentJson: null,
	status: "ready" as const,
	assets,
	uploadRunIds,
	config: {
		minReferences: 1,
		maxReferences: 5,
		defaultReferences: 3,
	},
});

/** An upload run of the actor's holding the assets, its call already done. */
const uploadRun = (
	actor: Actor,
	organizationId: OrganizationId,
	assetIds: readonly AssetId[],
) =>
	run(
		Effect.gen(function* () {
			const admission = yield* openUploadRun({
				userId: actor.user.id,
				organizationId,
				clientKey: crypto.randomUUID(),
			});
			if (!admission) throw new Error("No upload run");
			yield* admitStage(
				admission.runId,
				assetIds.map((assetId) => ({
					stage: "processing" as const,
					assetId,
				})),
			);
			yield* releaseAdmission(admission.leaseId);
			return admission.runId;
		}),
	);

const runBlock = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					blockId: dbSchema.activityRun.blockId,
				})
				.from(dbSchema.activityRun)
				.where(eq(dbSchema.activityRun.id, runId));
			return row?.blockId;
		}),
	);

const membersOf = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					assetId: dbSchema.activityMember.assetId,
					blockId: dbSchema.activityMember.blockId,
					indexing: dbSchema.activityMember.indexingState,
					actor: dbSchema.blockAsset.indexActorId,
				})
				.from(dbSchema.activityMember)
				.leftJoin(
					dbSchema.blockAsset,
					and(
						eq(dbSchema.blockAsset.assetId, dbSchema.activityMember.assetId),
						eq(dbSchema.blockAsset.blockId, dbSchema.activityMember.blockId),
					),
				)
				.where(eq(dbSchema.activityMember.runId, runId));
			return Object.fromEntries(
				rows.map((row) => [
					row.assetId,
					row,
				]),
			);
		}),
	);

/** Holds what `lock` locks in an open transaction; the returned function releases it. */
const hold = async (lock: Effect.Effect<unknown, unknown, DB>) => {
	const held = await run(Deferred.make<void>());
	const release = await run(Deferred.make<void>());
	const holder = await run(
		Effect.forkDetach(
			Effect.gen(function* () {
				yield* (yield* DB).transaction(() =>
					Effect.gen(function* () {
						yield* lock;
						yield* Deferred.succeed(held, undefined);
						yield* Deferred.await(release);
					}),
				);
			}),
		),
	);
	await run(Deferred.await(held));
	return async () => {
		await run(Deferred.succeed(release, undefined));
		await run(Fiber.join(holder));
	};
};

/** The worker's processing completion: the fenced write and what follows it. */
const completeProcessing = (assetId: AssetId, runId: ActivityRunId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const completed = yield* db
						.update(dbSchema.asset)
						.set({
							processingStatus: "completed",
						})
						.where(
							and(
								eq(dbSchema.asset.id, assetId),
								sql`${dbSchema.asset.processingStatus} in ('pending', 'active')`,
							),
						)
						.returning({
							id: dbSchema.asset.id,
						});
					if (completed.length === 0) return;
					yield* queueAfterProcessing({
						assetId,
						runId,
					});
				}),
			),
		);
	});

/** Whether a traced transaction ran its statement `first` more than once. */
const rerun = (statements: readonly string[], first: string) =>
	statements.filter((text) => text.startsWith(first)).length > 1;

const assetExists = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					id: dbSchema.asset.id,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return rows.length > 0;
		}),
	);

const pendingMembers = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					id: dbSchema.activityMember.id,
				})
				.from(dbSchema.activityMember)
				.where(
					and(
						eq(dbSchema.activityMember.runId, runId),
						sql`'pending' in (${dbSchema.activityMember.processingState}, ${dbSchema.activityMember.metadataState}, ${dbSchema.activityMember.indexingState})`,
					),
				);
			return rows.length;
		}),
	);

describe("repository save with upload runs", () => {
	test(
		"binds the user's upload: a processed asset's indexing is the run's work, an unprocessed one waits for its processing",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const processed = await createAsset(owner, organizationId);
			const waiting = await createAsset(owner, organizationId);
			const zedToken = waiting.zedToken ?? organizationToken;
			const runId = await uploadRun(owner, organizationId, [
				processed.asset.id,
				waiting.asset.id,
			]);
			await setProcessing(processed.asset.id, "completed");

			const p = await procedures();
			const { data: block, meta } = await run(
				p.block.create(
					repository(
						[
							processed.asset.id,
							waiting.asset.id,
						],
						[
							runId,
						],
					),
					await procedureOptions(owner, zedToken),
				),
			);
			expect(await runBlock(runId)).toBe(block.id);
			expect(await membersOf(runId)).toEqual({
				[processed.asset.id]: {
					assetId: processed.asset.id,
					blockId: block.id,
					indexing: "pending",
					actor: owner.user.id,
				},
				[waiting.asset.id]: {
					assetId: waiting.asset.id,
					blockId: block.id,
					indexing: null,
					actor: null,
				},
			});
			expect(
				(
					await runsOf(
						owner,
						[
							runId,
						],
						meta?.zedToken ?? zedToken,
					)
				)[0],
			).toMatchObject({
				kind: "upload",
				state: "running",
				repository: {
					id: block.id,
				},
			});

			// The repository is set once: a save elsewhere binds nothing.
			const other = await run(
				p.block.create(
					repository(
						[
							processed.asset.id,
						],
						[
							runId,
						],
					),
					await procedureOptions(owner, meta?.zedToken ?? zedToken),
				),
			);
			expect(await runBlock(runId)).toBe(block.id);
			expect((await membersOf(runId))[processed.asset.id]?.blockId).toBe(
				block.id,
			);
			expect(other.data.id).not.toBe(block.id);
		},
		TIMEOUT,
	);

	test(
		"binds neither another user's upload nor one of another organisation",
		async () => {
			const {
				organizationId,
				owner,
				member,
				zedToken: organizationToken,
			} = await organization();
			const elsewhere = await organization();
			const created = await createAsset(owner, organizationId);
			const zedToken = created.zedToken ?? organizationToken;
			const foreign = await uploadRun(member, organizationId, [
				created.asset.id,
			]);
			const otherOrganization = await uploadRun(
				owner,
				elsewhere.organizationId,
				[
					created.asset.id,
				],
			);

			await run(
				(await procedures()).block.create(
					repository(
						[
							created.asset.id,
						],
						[
							foreign,
							otherOrganization,
						],
					),
					await procedureOptions(owner, zedToken),
				),
			);
			expect(await runBlock(foreign)).toBeNull();
			expect(await runBlock(otherOrganization)).toBeNull();
			expect((await membersOf(foreign))[created.asset.id]?.blockId).toBeNull();
		},
		TIMEOUT,
	);

	/** A processed upload saved into a new repository, its indexing pending as the run's work. */
	const indexingUpload = async () => {
		const {
			organizationId,
			owner,
			zedToken: organizationToken,
		} = await organization();
		const created = await createAsset(owner, organizationId);
		const runId = await uploadRun(owner, organizationId, [
			created.asset.id,
		]);
		await endProcessing(created.asset.id, runId, "completed");
		const { data: block, meta } = await run(
			(await procedures()).block.create(
				repository(
					[
						created.asset.id,
					],
					[
						runId,
					],
				),
				await procedureOptions(owner, created.zedToken ?? organizationToken),
			),
		);
		const zedToken = meta?.zedToken ?? created.zedToken ?? organizationToken;
		expect(await stateOf(owner, runId, zedToken)).toBe("running");
		return {
			owner,
			assetId: created.asset.id,
			blockId: block.id,
			runId,
			zedToken,
		};
	};

	test(
		"unlinking an asset while it indexes ends the run's indexing as replaced",
		async () => {
			const { owner, assetId, blockId, runId, zedToken } =
				await indexingUpload();

			const { meta } = await run(
				(await procedures()).block.update(
					{
						id: blockId,
						...repository([], []),
					},
					await procedureOptions(owner, zedToken),
				),
			);

			expect((await membersOf(runId))[assetId]?.indexing).toBe("replaced");
			expect(await stateOf(owner, runId, meta?.zedToken ?? zedToken)).toBe(
				"finished",
			);
		},
		TIMEOUT,
	);

	test(
		"deleting the repository while processing admits the run's indexing leaves nothing pending",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const assetId = created.asset.id;
			const runId = await uploadRun(owner, organizationId, [
				assetId,
			]);
			const { data: block, meta } = await run(
				(await procedures()).block.create(
					repository(
						[
							assetId,
						],
						[
							runId,
						],
					),
					await procedureOptions(owner, created.zedToken ?? organizationToken),
				),
			);
			const zedToken = meta?.zedToken ?? created.zedToken ?? organizationToken;
			expect((await membersOf(runId))[assetId]?.indexing).toBeNull();
			const admitted = await run(Deferred.make<void>());
			const commit = await run(Deferred.make<void>());

			// Processing completes and admits the run's indexing on the link, not yet committed.
			const processing = await run(
				Effect.forkDetach(
					Effect.gen(function* () {
						const db = yield* DB;
						yield* db.transaction(() =>
							Effect.gen(function* () {
								const links = yield* db
									.select({
										assetId: dbSchema.blockAsset.assetId,
										blockId: dbSchema.blockAsset.blockId,
										attempt: dbSchema.blockAsset.indexAttempt,
									})
									.from(dbSchema.blockAsset)
									.where(eq(dbSchema.blockAsset.assetId, assetId));
								yield* queueIndexing(links, runId);
								yield* Deferred.succeed(admitted, undefined);
								yield* Deferred.await(commit);
							}),
						);
					}),
				),
			);
			await run(Deferred.await(admitted));

			const deletion = (async () =>
				run(
					(await procedures()).block.delete(
						{
							refs: [
								{
									id: block.id,
								},
							],
						},
						await procedureOptions(owner, zedToken),
					),
				))();
			await run(awaitLockWaiters("%block%"));
			await run(Deferred.succeed(commit, undefined));
			await run(Fiber.join(processing));
			await deletion;

			expect((await membersOf(runId))[assetId]).toMatchObject({
				blockId: null,
				indexing: "replaced",
			});
		},
		TIMEOUT,
	);

	test(
		"processing completing while the repository is deleted takes the links before the member, so neither deadlocks",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const assetId = created.asset.id;
			const runId = await uploadRun(owner, organizationId, [
				assetId,
			]);
			const { data: block } = await run(
				(await procedures()).block.create(
					repository(
						[
							assetId,
						],
						[
							runId,
						],
					),
					await procedureOptions(owner, created.zedToken ?? organizationToken),
				),
			);

			// Holds the member, so completion reaches it first and deletion queues behind.
			const release = await hold(
				Effect.gen(function* () {
					yield* (yield* DB)
						.select({
							id: dbSchema.activityMember.id,
						})
						.from(dbSchema.activityMember)
						.where(eq(dbSchema.activityMember.runId, runId))
						.for("update");
				}),
			);
			const completion = await run(
				Effect.forkDetach(traced(completeProcessing(assetId, runId))),
			);
			await run(awaitLockWaiters("%activity_member%"));
			const deletion = run(
				traced(
					deleteResourcesWithAuthorization({
						resourceType: "block",
						resourceIds: [
							block.id,
						],
					}),
				),
			);
			await run(awaitLockWaiters("%block%"));
			await release();
			const completed = await run(Fiber.join(completion));
			const deleted = await deletion;

			expect(
				rerun(completed.statements, 'update "asset" set "processing_status"'),
			).toBe(false);
			expect(
				rerun(
					deleted.statements,
					'select "id" from "block" where "block"."id" in',
				),
			).toBe(false);
			expect((await membersOf(runId))[assetId]).toMatchObject({
				blockId: null,
				indexing: "replaced",
			});
		},
		TIMEOUT,
	);

	test(
		"processing completing while the organisation is deleted deadlocks, and the victim runs again",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const other = await createAsset(owner, organizationId);
			const assetId = created.asset.id;
			const runId = await uploadRun(owner, organizationId, [
				assetId,
			]);
			const { data: block } = await run(
				(await procedures()).block.create(
					repository(
						[
							assetId,
							other.asset.id,
						],
						[
							runId,
						],
					),
					await procedureOptions(owner, other.zedToken ?? organizationToken),
				),
			);

			// Holds the other asset's link, so deletion stops holding the repository, before the assets.
			const release = await hold(
				Effect.gen(function* () {
					yield* (yield* DB)
						.select({
							blockId: dbSchema.blockAsset.blockId,
						})
						.from(dbSchema.blockAsset)
						.where(
							and(
								eq(dbSchema.blockAsset.blockId, block.id),
								eq(dbSchema.blockAsset.assetId, other.asset.id),
							),
						)
						.for("update");
				}),
			);
			const deletion = await run(
				Effect.forkDetach(
					traced(
						deleteOrganizationsWithAuthorization([
							organizationId,
						]),
					),
				),
			);
			await run(awaitLockWaiters("%block_asset%"));
			// Completion holds the asset and waits for the repository.
			const completion = await run(
				Effect.forkDetach(traced(completeProcessing(assetId, runId))),
			);
			await run(awaitLockWaiters("%for key share%"));
			await release();
			const completed = await run(Fiber.join(completion));
			const deleted = await run(Fiber.join(deletion));

			expect(
				rerun(completed.statements, 'update "asset" set "processing_status"') ||
					rerun(deleted.statements, 'select "id", "logo" from "organization"'),
			).toBe(true);
			expect(await assetExists(assetId)).toBe(false);
			expect(await pendingMembers(runId)).toBe(0);
		},
		TIMEOUT,
	);

	test(
		"an indexing retry while the asset is deleted deadlocks, and the victim runs again",
		async () => {
			const { owner, assetId, blockId, runId, zedToken } =
				await indexingUpload();
			const [link] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							assetId: dbSchema.blockAsset.assetId,
							blockId: dbSchema.blockAsset.blockId,
							attempt: dbSchema.blockAsset.indexAttempt,
						})
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.assetId, assetId));
				}),
			);
			if (!link) throw new Error("No link");

			// Holds the upload's member, so the retry stops holding the link, before its own member.
			const release = await hold(
				Effect.gen(function* () {
					yield* (yield* DB)
						.select({
							id: dbSchema.activityMember.id,
						})
						.from(dbSchema.activityMember)
						.where(eq(dbSchema.activityMember.runId, runId))
						.for("update");
				}),
			);
			const retry = await run(
				Effect.forkDetach(
					traced(
						inActivityRun(
							{
								userId: owner.user.id,
								kind: "retry",
								organizationId: homeOrganization("block", blockId),
								blockId,
							},
							(retryRunId) =>
								queueIndexing(
									[
										link,
									],
									retryRunId,
								),
						),
					),
				),
			);
			await run(awaitLockWaiters("%activity_member%"));
			// Deletion holds the asset and waits for the link.
			const deletion = run(
				traced(
					deleteResourcesWithAuthorization({
						resourceType: "asset",
						resourceIds: [
							assetId,
						],
					}),
				),
			);
			await run(awaitLockWaiters("%block_asset%"));
			await release();
			const retried = await run(Fiber.join(retry));
			const deleted = await deletion;

			expect(
				rerun(retried.statements, 'insert into "activity_run"') ||
					rerun(deleted.statements, 'select "id" from "asset" where'),
			).toBe(true);
			expect(await assetExists(assetId)).toBe(false);
			expect((await summary(owner, zedToken)).running).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"processing completion reads the binding of a save that committed while it waited for the links",
		async () => {
			const {
				organizationId,
				owner,
				zedToken: organizationToken,
			} = await organization();
			const created = await createAsset(owner, organizationId);
			const assetId = created.asset.id;
			const runId = await uploadRun(owner, organizationId, [
				assetId,
			]);
			const p = await procedures();
			const { data: elsewhere, meta } = await run(
				p.block.create(
					repository(
						[
							assetId,
						],
						[],
					),
					await procedureOptions(owner, created.zedToken ?? organizationToken),
				),
			);
			const zedToken = meta?.zedToken ?? created.zedToken ?? organizationToken;

			// Holds the repository the asset is already in, so completion waits before it reads links and binding.
			const release = await hold(
				Effect.gen(function* () {
					yield* (yield* DB)
						.select({
							id: dbSchema.block.id,
						})
						.from(dbSchema.block)
						.where(eq(dbSchema.block.id, elsewhere.id))
						.for("update");
				}),
			);
			const completion = await run(
				Effect.forkDetach(completeProcessing(assetId, runId)),
			);
			await run(awaitLockWaiters("%for key share%"));
			// The save links and binds, commits, then waits for completion to index.
			const save = (async () =>
				run(
					p.block.create(
						repository(
							[
								assetId,
							],
							[
								runId,
							],
						),
						await procedureOptions(owner, zedToken),
					),
				))();
			await run(awaitLockWaiters("%for share%"));
			await release();
			await run(Fiber.join(completion));
			const { data: block } = await save;

			expect((await membersOf(runId))[assetId]).toEqual({
				assetId,
				blockId: block.id,
				indexing: "pending",
				actor: owner.user.id,
			});
		},
		TIMEOUT,
	);

	test(
		"deleting the repository while an asset indexes ends the run's indexing as replaced",
		async () => {
			const { owner, assetId, blockId, runId, zedToken } =
				await indexingUpload();

			await run(
				(await procedures()).block.delete(
					{
						refs: [
							{
								id: blockId,
							},
						],
					},
					await procedureOptions(owner, zedToken),
				),
			);

			expect((await membersOf(runId))[assetId]).toMatchObject({
				blockId: null,
				indexing: "replaced",
			});
			expect(await stateOf(owner, runId, zedToken)).toBe("finished");
		},
		TIMEOUT,
	);
});
