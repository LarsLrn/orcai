import { expect, test } from "bun:test";
import type { PgClient } from "@effect/sql-pg";
import type { QuotaPeriodId, QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	awaitLockWaiters,
	createOrganization,
	createUser,
	holdLock,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";
import { STALE_RESERVATION_AGE_MS } from "../src/call-timeout";
import {
	type QuotaReservations,
	QuotaReservationsLive,
	recoverStaleQuotaReservations,
} from "../src/enforcement";
import {
	createQuotaPoolWithInitialPeriod,
	recordQuotaUsage,
	settleQuotaReservation,
} from "../src/ledger";
import { QuotaRetry, startMeteredCall } from "../src/metered-call";
import { openQuotaPeriod } from "../src/period";

const runtime = integrationRuntime(QuotaReservationsLive);

/** The database, with every transaction failing while `broken.on`, as when its connection drops. */
const failingTransactions = (
	db: Context.Service.Shape<typeof DB>,
	broken: {
		on: boolean;
	},
) =>
	new Proxy(db, {
		get: (target, property) => {
			if (property === "transaction" && broken.on) {
				return () => Effect.fail(new Error("connection lost"));
			}
			const value = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

const run = <A, E>(
	effect: Effect.Effect<A, E, DB | PgClient.PgClient | QuotaReservations>,
) => runtime.runPromise(effect);

/** A pool open to every member of a fresh organization. */
const pool = (params: {
	budgetAmount: number;
	meteringMode: "requests" | "tokens";
}) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const { organization } = yield* createOrganization();
			const [provider] = yield* db
				.insert(dbSchema.provider)
				.values({
					organizationId: organization.id,
					name: "Quota provider",
					kind: "openai",
					description: "",
					apiKeyEncrypted: "unused",
					meteringMode: params.meteringMode,
				})
				.returning();
			const [allMembers] = yield* db
				.insert(dbSchema.group)
				.values({
					organizationId: organization.id,
					name: "All members",
					kind: "system",
					systemKey: "all_members",
					createdBy: user.id,
				})
				.returning();
			const { pool } = yield* createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Quota pool",
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: params.budgetAmount,
				priority: 0,
				isDefault: true,
				createdByUserId: user.id,
				assignedGroupIds: [
					allMembers.id,
				],
			});
			return {
				poolId: pool.id,
				userId: user.id,
				start: (
					amount: number,
					appRequestId = crypto.randomUUID(),
					allowOverBudget?: boolean,
				) =>
					startMeteredCall({
						organizationId: organization.id,
						userId: user.id,
						providerId: provider.id,
						modelId: null,
						appRequestId,
						maxRequests: amount,
						maxOutputTokens: amount,
						inputTokens: 0,
						allowOverBudget,
					}),
			};
		}),
	);

const requestPool = (budgetAmount: number) =>
	pool({
		budgetAmount,
		meteringMode: "requests",
	});

/** The pool's current ledger, or the one of `periodId`. */
const ledgerOf = (quotaPoolId: QuotaPoolId, periodId?: QuotaPeriodId) =>
	run(
		Effect.gen(function* () {
			const quotaPeriodId =
				periodId ??
				(yield* openQuotaPeriod({
					quotaPoolId,
				})).period.id;
			const [row] = yield* (yield* DB)
				.select()
				.from(dbSchema.quotaLedger)
				.where(
					and(
						eq(dbSchema.quotaLedger.quotaPoolId, quotaPoolId),
						eq(dbSchema.quotaLedger.quotaPeriodId, quotaPeriodId),
					),
				);
			return row;
		}),
	);

const eventsOf = (appRequestId: string) =>
	run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select()
				.from(dbSchema.quotaUsageEvent)
				.where(eq(dbSchema.quotaUsageEvent.appRequestId, appRequestId));
		}),
	);

const eventTypes = async (appRequestId: string) =>
	(await eventsOf(appRequestId)).map((event) => event.eventType).sort();

const reservationKeyOf = async (appRequestId: string) =>
	(await eventsOf(appRequestId)).find((event) => event.eventType === "reserved")
		?.reservationKey ?? "";

/** Makes the call's reservation older than any call can run, as when its process died. */
const ageReservation = (appRequestId: string) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.quotaUsageEvent)
				.set({
					occurredAt: new Date(Date.now() - STALE_RESERVATION_AGE_MS - 60_000),
				})
				.where(eq(dbSchema.quotaUsageEvent.appRequestId, appRequestId));
		}),
	);

// Also ends whatever else in the database went stale.
const recoverStale = () =>
	run(
		recoverStaleQuotaReservations({
			reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
			limit: 500,
		}),
	);

const step = {
	inputTokens: 100,
	outputTokens: 20,
	totalTokens: 120,
};

test("concurrent calls are granted the budget and no more", async () => {
	const { poolId, start } = await requestPool(10);

	const results = await Promise.all(
		Array.from(
			{
				length: 15,
			},
			() => run(Effect.result(start(1))),
		),
	);

	const granted = results.filter((result) => result._tag === "Success");
	expect(granted).toHaveLength(10);
	expect(results.filter((result) => result._tag === "Failure")).toEqual(
		Array(5).fill(
			expect.objectContaining({
				failure: expect.objectContaining({
					_tag: "QuotaDeniedError",
					reason: "QUOTA_EXHAUSTED",
				}),
			}),
		),
	);
	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 10,
		remainingAmount: 0,
	});
});

test("a request-metered call is granted what remains when less than it asks", async () => {
	const { start } = await requestPool(10);
	await run(start(7));

	expect((await run(start(25))).maxRequests).toBe(3);
	expect(await run(Effect.flip(start(1)))).toMatchObject({
		reason: "QUOTA_EXHAUSTED",
	});
});

test("a token-metered call is refused unless all it asks remains", async () => {
	const { poolId, start } = await pool({
		budgetAmount: 1000,
		meteringMode: "tokens",
	});

	expect(await run(Effect.flip(start(1001)))).toMatchObject({
		_tag: "QuotaDeniedError",
		reason: "QUOTA_EXHAUSTED",
	});
	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		remainingAmount: 1000,
	});
});

const finalizedOf = async (appRequestId: string) =>
	(await eventsOf(appRequestId)).filter(
		(event) => event.eventType === "finalized",
	);

test("a call allowed over budget runs on a used-up pool and is charged all it used to the person", async () => {
	const { poolId, userId, start } = await pool({
		budgetAmount: 100,
		meteringMode: "tokens",
	});
	const appRequestId = crypto.randomUUID();

	expect(await run(Effect.flip(start(1000)))).toMatchObject({
		reason: "QUOTA_EXHAUSTED",
	});
	const call = await run(start(1000, appRequestId, true));
	await run(call.record(step));
	await run(call.settle("completed"));

	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 120,
		remainingAmount: 0,
	});
	expect(await finalizedOf(appRequestId)).toEqual([
		expect.objectContaining({
			userId,
			actualAmount: 120,
		}),
	]);
});

test("a settled call is charged its steps and frees the rest", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	const call = await run(start(6, appRequestId));

	await run(call.record(step));
	await run(call.record(step));
	await run(call.settle("completed"));

	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 2,
		remainingAmount: 8,
	});
	expect(
		(await eventsOf(appRequestId)).find(
			(event) => event.eventType === "finalized",
		),
	).toMatchObject({
		actualAmount: 2,
		requestCount: 2,
		totalTokens: 240,
		metadata: null,
	});
});

test("a call without a step frees all it reserved, and only a provider failure shows as failed", async () => {
	const { poolId, start } = await requestPool(10);
	const failed = crypto.randomUUID();
	const cancelled = crypto.randomUUID();

	await run(Effect.flatMap(start(4, failed), (call) => call.settle("failed")));
	await run(
		Effect.flatMap(start(4, cancelled), (call) => call.settle("cancelled")),
	);

	expect((await ledgerOf(poolId)).remainingAmount).toBe(10);
	expect(await eventTypes(failed)).toEqual([
		"failed",
		"released",
		"reserved",
	]);
	expect(await eventTypes(cancelled)).toEqual([
		"released",
		"reserved",
	]);
});

test("a call whose settle failed is charged its stored steps once its period closed", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	const broken = {
		on: false,
	};
	const db = await run(
		Effect.gen(function* () {
			return yield* DB;
		}),
	);
	const call = await run(
		start(6, appRequestId).pipe(
			Effect.provide(Layer.fresh(QuotaReservationsLive)),
			Effect.provideService(DB, failingTransactions(db, broken)),
			Effect.provideService(QuotaRetry, Schedule.recurs(1)),
		),
	);
	await run(call.record(step));
	await run(call.record(step));
	broken.on = true;
	await run(call.settle("completed"));
	const [reserved] = await eventsOf(appRequestId);
	expect(await ledgerOf(poolId, reserved.quotaPeriodId)).toMatchObject({
		reservedAmount: 6,
		consumedAmount: 0,
	});
	// The process went away, then the period rolled over.
	await ageReservation(appRequestId);
	await run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.quotaPeriod)
				.set({
					status: "closed",
					closedAt: new Date(),
				})
				.where(eq(dbSchema.quotaPeriod.id, reserved.quotaPeriodId));
		}),
	);

	await recoverStale();

	expect(await ledgerOf(poolId, reserved.quotaPeriodId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 2,
	});
	expect(await finalizedOf(appRequestId)).toEqual([
		expect.objectContaining({
			actualAmount: 2,
			requestCount: 2,
			inputTokens: 200,
			metadata: {
				recoveredAfterInterruption: true,
			},
		}),
	]);
}, 30_000);

test("a stale reservation with a corrupt stored step is charged what it can read", async () => {
	const { poolId, start } = await requestPool(10);
	const sentinel = "stored prompt text that must stay out of logs";
	const appRequestId = crypto.randomUUID();
	await run(start(6, appRequestId));
	const [reserved] = await eventsOf(appRequestId);
	await run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.quotaUsageEvent)
				.set({
					metadata: {
						...reserved.metadata,
						steps: [
							null,
							{
								outputTokens: sentinel,
							},
							step,
						],
					},
				})
				.where(eq(dbSchema.quotaUsageEvent.id, reserved.id));
		}),
	);
	await ageReservation(appRequestId);
	const logged: unknown[] = [];

	await run(
		recoverStaleQuotaReservations({
			reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
			limit: 500,
		}).pipe(
			Effect.provide(
				Logger.layer([
					Logger.make(({ message }) => {
						logged.push(message);
					}),
				]),
			),
		),
	);

	expect(await ledgerOf(poolId, reserved.quotaPeriodId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 3,
	});
	expect(await finalizedOf(appRequestId)).toEqual([
		expect.objectContaining({
			actualAmount: 3,
			requestCount: 3,
			inputTokens: 100,
		}),
	]);
	expect(logged.flat()).toContainEqual(
		expect.objectContaining({
			message: "quota.steps.corrupt",
			reservationKey: reserved.reservationKey,
			corrupt: [
				{
					index: 0,
					paths: [
						"",
					],
				},
				{
					index: 1,
					paths: [
						"outputTokens",
					],
				},
			],
		}),
	);
	expect(JSON.stringify(logged)).not.toContain(sentinel);
}, 30_000);

test("a recovery that meets a usage write still being stored charges what it stored", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	await run(start(6, appRequestId));
	const reservationKey = await reservationKeyOf(appRequestId);
	await ageReservation(appRequestId);

	await run(
		Effect.gen(function* () {
			const release = yield* holdLock(
				recordQuotaUsage({
					reservationKey,
					steps: [
						step,
						step,
					],
				}),
			);
			const recovering = yield* Effect.forkChild(
				recoverStaleQuotaReservations({
					reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
					limit: 500,
				}),
			);
			yield* awaitLockWaiters("%quota_usage_event%for update%");
			yield* release;
			yield* Fiber.join(recovering);
		}),
	);

	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 2,
	});
	expect(await finalizedOf(appRequestId)).toEqual([
		expect.objectContaining({
			actualAmount: 2,
		}),
	]);
}, 30_000);

test("a late settle that meets a recovery changes nothing", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	const call = await run(start(6, appRequestId));
	await run(call.record(step));
	await run(call.record(step));
	const reservationKey = await reservationKeyOf(appRequestId);

	await run(
		Effect.gen(function* () {
			// The stale job ends the reservation from its stored steps.
			const release = yield* holdLock(
				settleQuotaReservation({
					reservationKey,
					steps: undefined,
					reason: "expired",
					prices: null,
				}),
			);
			const settling = yield* Effect.forkChild(
				call.record(step).pipe(Effect.andThen(call.settle("completed"))),
			);
			yield* awaitLockWaiters("%quota_usage_event%for update%");
			yield* release;
			yield* Fiber.join(settling);
		}),
	);

	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 2,
	});
	expect(await finalizedOf(appRequestId)).toEqual([
		expect.objectContaining({
			actualAmount: 2,
			metadata: {
				recoveredAfterInterruption: true,
			},
		}),
	]);
});

test("a call that never settled and stored no step is released", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	await run(start(6, appRequestId));
	await ageReservation(appRequestId);

	await recoverStale();

	expect(await ledgerOf(poolId)).toMatchObject({
		reservedAmount: 0,
		consumedAmount: 0,
		remainingAmount: 10,
	});
	expect(await eventTypes(appRequestId)).toEqual([
		"released",
		"reserved",
	]);
}, 30_000);

test("a repeated or older usage write counts nothing twice", async () => {
	const { start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	await run(start(6, appRequestId));
	const reservationKey = await reservationKeyOf(appRequestId);
	const write = (count: number) =>
		run(
			recordQuotaUsage({
				reservationKey,
				steps: Array(count).fill(step),
			}),
		);

	await write(2);
	await write(2);
	await write(1);

	expect(
		(await eventsOf(appRequestId)).find(
			(event) => event.eventType === "reserved",
		),
	).toMatchObject({
		requestCount: 2,
		totalTokens: 240,
	});
	await run(
		settleQuotaReservation({
			reservationKey,
			steps: undefined,
			reason: "expired",
			prices: null,
		}),
	);
	expect(await write(3)).toBe("settled");
});

test("concurrent settles end a reservation once", async () => {
	const { poolId, start } = await requestPool(10);
	const appRequestId = crypto.randomUUID();
	await run(start(6, appRequestId));
	const reservationKey = await reservationKeyOf(appRequestId);

	const results = await Promise.all(
		[
			1,
			2,
			3,
		].map((count) =>
			run(
				settleQuotaReservation({
					reservationKey,
					steps: Array(count).fill(step),
					reason: "app_failure",
					prices: null,
				}),
			),
		),
	);

	expect(results.filter((result) => result?.inserted)).toHaveLength(1);
	const consumed = (await ledgerOf(poolId)).consumedAmount;
	expect(await eventTypes(appRequestId)).toEqual([
		"finalized",
		"reserved",
	]);
	expect(
		(await eventsOf(appRequestId)).find(
			(event) => event.eventType === "finalized",
		)?.actualAmount,
	).toBe(consumed);
});
