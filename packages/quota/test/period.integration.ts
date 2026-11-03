import { expect, test } from "bun:test";
import type { GroupId, QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	awaitLockWaiters,
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "../src/enforcement";
import {
	createQuotaPoolWithInitialPeriod,
	updateQuotaPoolBudget,
} from "../src/ledger";
import {
	listExpiredOpenQuotaPeriods,
	openQuotaPeriod,
	rollOverQuotaPeriods,
} from "../src/period";
import { resolveQuotaPool } from "../src/resolver";

const runtime = integrationRuntime();

/** An organization with a requests provider, a model and its All members group. */
const organizationWithProvider = () =>
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
				meteringMode: "requests",
			})
			.returning();
		const model = () =>
			db
				.insert(dbSchema.model)
				.values({
					providerId: provider.id,
					providerModelId: `model-${crypto.randomUUID()}`,
					name: "Quota model",
					description: "",
					capabilities: [
						"text",
					],
				})
				.returning()
				.pipe(Effect.map(([row]) => row));
		const group = (systemKey?: "all_members") =>
			db
				.insert(dbSchema.group)
				.values({
					organizationId: organization.id,
					name: systemKey ? "All members" : `Team ${crypto.randomUUID()}`,
					kind: systemKey ? "system" : "custom",
					systemKey,
					createdBy: user.id,
				})
				.returning()
				.pipe(Effect.map(([row]) => row));
		const allMembers = yield* group("all_members");
		const createPool = (params: {
			modelId?: (typeof dbSchema.model.$inferSelect)["id"];
			priority?: number;
			isActive?: boolean;
			groupIds?: GroupId[];
		}) =>
			createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Quota pool",
				providerId: provider.id,
				modelId: params.modelId,
				periodType: "monthly",
				budgetAmount: 100,
				priority: params.priority ?? 0,
				isDefault: false,
				isActive: params.isActive,
				createdByUserId: user.id,
				assignedGroupIds: params.groupIds ?? [
					allMembers.id,
				],
			});
		return {
			user,
			organization,
			provider,
			model,
			group,
			createPool,
		};
	});

/** Moves the pool's open period into the past, as if its reset went by unnoticed. */
const endOpenPeriod = (quotaPoolId: QuotaPoolId) =>
	Effect.gen(function* () {
		yield* (yield* DB)
			.update(dbSchema.quotaPeriod)
			.set({
				startsAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
				endsAt: new Date(Date.now() - 1000),
			})
			.where(
				and(
					eq(dbSchema.quotaPeriod.quotaPoolId, quotaPoolId),
					eq(dbSchema.quotaPeriod.status, "open"),
				),
			);
	});

const periodsOf = (quotaPoolId: QuotaPoolId) =>
	Effect.gen(function* () {
		return yield* (yield* DB)
			.select()
			.from(dbSchema.quotaPeriod)
			.where(eq(dbSchema.quotaPeriod.quotaPoolId, quotaPoolId));
	});

test("everything that reads a pool at its reset succeeds and opens one period", async () => {
	const { opened, periods, reservations } = await runtime.runPromise(
		Effect.gen(function* () {
			const fixture = yield* organizationWithProvider();
			const { pool, period: ended } = yield* fixture.createPool({});
			yield* endOpenPeriod(pool.id);

			const reserve = reserveForAppRequest({
				organizationId: fixture.organization.id,
				userId: fixture.user.id,
				providerId: fixture.provider.id,
				appRequestId: `quota_${crypto.randomUUID()}`,
				maxExpectedProviderRequests: 1,
				messages: [],
			});
			const statusRead = openQuotaPeriod({
				quotaPoolId: pool.id,
			}).pipe(Effect.map(({ period }) => period.id));
			// Other files' pools are not this test's to roll over.
			const rollover = listExpiredOpenQuotaPeriods().pipe(
				Effect.flatMap((poolIds) =>
					Effect.forEach(
						poolIds.filter((id) => id === pool.id),
						(quotaPoolId) =>
							openQuotaPeriod({
								quotaPoolId,
							}),
					),
				),
			);
			const budgetUpdate = updateQuotaPoolBudget({
				poolId: pool.id,
				organizationId: fixture.organization.id,
				newBudgetAmount: 200,
				actorUserId: fixture.user.id,
			});

			const [opened, reservations] = yield* Effect.all(
				[
					Effect.all(
						Array.from(
							{
								length: 10,
							},
							() => statusRead,
						),
						{
							concurrency: "unbounded",
						},
					),
					Effect.all(
						Array.from(
							{
								length: 10,
							},
							() => reserve,
						),
						{
							concurrency: "unbounded",
						},
					),
					rollover,
					budgetUpdate,
				],
				{
					concurrency: "unbounded",
				},
			);
			const periods = yield* periodsOf(pool.id);
			return {
				opened: {
					ended: ended.id,
					ids: opened,
				},
				periods,
				reservations,
			};
		}),
	);

	const open = periods.filter((period) => period.status === "open");
	expect(open).toHaveLength(1);
	expect(periods.find((period) => period.id === opened.ended)?.status).toBe(
		"closed",
	);
	expect(new Set(opened.ids)).toEqual(
		new Set([
			open[0].id,
		]),
	);
	expect(reservations.map((result) => result.reservation?.periodId)).toEqual(
		Array(10).fill(open[0].id),
	);
});

test("a reservation that resolved its pool before the reset lands on the new period", async () => {
	const { reservation, periods } = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const fixture = yield* organizationWithProvider();
			const { pool } = yield* fixture.createPool({});
			yield* endOpenPeriod(pool.id);
			const locked = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();

			// The rollover opens the next period and holds the pool until released.
			const rollover = yield* db
				.transaction(() =>
					openQuotaPeriod({
						quotaPoolId: pool.id,
					}).pipe(
						Effect.tap(() => Effect.sync(() => locked.resolve())),
						Effect.tap(() => Effect.promise(() => release.promise)),
					),
				)
				.pipe(Effect.forkChild);
			yield* Effect.promise(() => locked.promise);
			const reserving = yield* reserveForAppRequest({
				organizationId: fixture.organization.id,
				userId: fixture.user.id,
				providerId: fixture.provider.id,
				appRequestId: `quota_${crypto.randomUUID()}`,
				maxExpectedProviderRequests: 1,
				messages: [],
			}).pipe(Effect.forkChild);
			yield* awaitLockWaiters("%quota_pool%for no key update%");
			release.resolve();
			yield* Fiber.join(rollover);
			const { reservation } = yield* Fiber.join(reserving);
			return {
				reservation,
				periods: yield* periodsOf(pool.id),
			};
		}),
	);

	const open = periods.find((period) => period.status === "open");
	expect(periods).toHaveLength(2);
	expect(reservation?.periodId).toBe(open?.id);
});

test("pools are drawn on in the documented order, the first only", async () => {
	const { resolution, expected } = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const fixture = yield* organizationWithProvider();
			const model = yield* fixture.model();
			const otherModel = yield* fixture.model();
			const team = yield* fixture.group();
			const otherTeam = yield* fixture.group();
			yield* db.insert(dbSchema.groupMember).values({
				groupId: team.id,
				userId: fixture.user.id,
				addedBy: fixture.user.id,
			});
			const created = (pool: {
				pool: {
					id: QuotaPoolId;
				};
			}) => pool.pool.id;
			const createdAt = (quotaPoolId: QuotaPoolId, at: Date) =>
				db
					.update(dbSchema.quotaPool)
					.set({
						createdAt: at,
					})
					.where(eq(dbSchema.quotaPool.id, quotaPoolId));

			const allModels = created(
				yield* fixture.createPool({
					priority: 9,
				}),
			);
			const newerForModel = created(
				yield* fixture.createPool({
					modelId: model.id,
				}),
			);
			const olderForModel = created(
				yield* fixture.createPool({
					modelId: model.id,
				}),
			);
			yield* createdAt(newerForModel, new Date(Date.now() - 1000));
			yield* createdAt(olderForModel, new Date(Date.now() - 2000));
			const teamForModel = created(
				yield* fixture.createPool({
					modelId: model.id,
					priority: 1,
					groupIds: [
						team.id,
					],
				}),
			);
			// None of these covers the person and model.
			yield* fixture.createPool({
				modelId: model.id,
				priority: 5,
				groupIds: [
					otherTeam.id,
				],
			});
			yield* fixture.createPool({
				modelId: model.id,
				priority: 5,
				isActive: false,
			});
			yield* fixture.createPool({
				modelId: otherModel.id,
				priority: 5,
			});

			const resolution = yield* resolveQuotaPool({
				organizationId: fixture.organization.id,
				userId: fixture.user.id,
				providerId: fixture.provider.id,
				modelId: model.id,
			});
			return {
				resolution,
				expected: [
					teamForModel,
					olderForModel,
					newerForModel,
					allModels,
				],
			};
		}),
	);

	expect(resolution.orderedCandidatePoolIds).toEqual(expected);
	expect(resolution.winningPool?.pool.id).toBe(expected[0]);
});

test("a pool whose rollover fails leaves the others rolled over", async () => {
	const { failed, open } = await runtime.runPromise(
		Effect.gen(function* () {
			const fixture = yield* organizationWithProvider();
			const pools = [
				(yield* fixture.createPool({})).pool.id,
				(yield* fixture.createPool({})).pool.id,
			];
			yield* Effect.forEach(pools, endOpenPeriod);

			const failed = yield* rollOverQuotaPeriods([
				pools[0],
				crypto.randomUUID() as QuotaPoolId,
				pools[1],
			]);
			const open = yield* Effect.forEach(pools, (quotaPoolId) =>
				periodsOf(quotaPoolId).pipe(
					Effect.map((periods) =>
						periods.filter(
							(period) =>
								period.status === "open" && period.endsAt > new Date(),
						),
					),
				),
			);
			return {
				failed,
				open,
			};
		}),
	);

	expect(failed).toBe(1);
	expect(open.map((periods) => periods.length)).toEqual([
		1,
		1,
	]);
});

/** Runs `change` to the pool in a transaction held open until `waiters` wait on the pool. */
const heldPoolChange = <A>(
	quotaPoolId: QuotaPoolId,
	change: Partial<typeof dbSchema.quotaPool.$inferInsert>,
	waiting: Effect.Effect<A, unknown, DB>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const changed = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const holding = yield* db
			.transaction(() =>
				db
					.update(dbSchema.quotaPool)
					.set(change)
					.where(eq(dbSchema.quotaPool.id, quotaPoolId))
					.pipe(
						Effect.tap(() => Effect.sync(() => changed.resolve())),
						Effect.tap(() => Effect.promise(() => release.promise)),
					),
			)
			.pipe(Effect.forkChild);
		yield* Effect.promise(() => changed.promise);
		const waiter = yield* Effect.forkChild(waiting);
		yield* awaitLockWaiters("%quota_pool%for no key update%");
		release.resolve();
		yield* Fiber.join(holding);
		return yield* Fiber.join(waiter);
	});

test("a period type changed while the next period opens sets its bounds", async () => {
	const period = await runtime.runPromise(
		Effect.gen(function* () {
			const fixture = yield* organizationWithProvider();
			const { pool } = yield* fixture.createPool({});
			yield* endOpenPeriod(pool.id);

			const { period } = yield* heldPoolChange(
				pool.id,
				{
					periodType: "weekly",
				},
				openQuotaPeriod({
					quotaPoolId: pool.id,
				}),
			);
			return period;
		}),
	);

	expect(period.endsAt.getTime() - period.startsAt.getTime()).toBe(
		7 * 24 * 60 * 60 * 1000,
	);
});

test("a pool deactivated after the call resolved it takes no reservation", async () => {
	const result = await runtime.runPromise(
		Effect.gen(function* () {
			const fixture = yield* organizationWithProvider();
			const { pool } = yield* fixture.createPool({});

			return yield* heldPoolChange(
				pool.id,
				{
					isActive: false,
				},
				reserveForAppRequest({
					organizationId: fixture.organization.id,
					userId: fixture.user.id,
					providerId: fixture.provider.id,
					appRequestId: `quota_${crypto.randomUUID()}`,
					maxExpectedProviderRequests: 1,
					messages: [],
				}),
			);
		}),
	);

	expect(result).toEqual({
		allowed: false,
		denialReason: "no_pool",
	});
});

/** Holds the pool's ledger row in a transaction until released, then runs `then` in it. */
const heldLedger = <A>(
	quotaPoolId: QuotaPoolId,
	then: Effect.Effect<A, unknown, DB>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const holding = yield* db
			.transaction(() =>
				db
					.select()
					.from(dbSchema.quotaLedger)
					.where(eq(dbSchema.quotaLedger.quotaPoolId, quotaPoolId))
					.for("update")
					.pipe(
						Effect.tap(() => Effect.sync(() => locked.resolve())),
						Effect.tap(() => Effect.promise(() => release.promise)),
						Effect.andThen(then),
					),
			)
			.pipe(Effect.forkChild);
		yield* Effect.promise(() => locked.promise);
		return {
			/** Lets the holder finish once something waits for the ledger. */
			finish: Effect.gen(function* () {
				yield* awaitLockWaiters("%quota_ledger%for update%");
				release.resolve();
				return yield* Fiber.join(holding);
			}),
		};
	});

test.each([
	"finalize",
	"release",
] as const)(
	"a reservation waiting for the ledger lets a %s holding it finish",
	async (settle) => {
		const second = await runtime.runPromise(
			Effect.gen(function* () {
				const fixture = yield* organizationWithProvider();
				yield* fixture.createPool({});
				const reserve = reserveForAppRequest({
					organizationId: fixture.organization.id,
					userId: fixture.user.id,
					providerId: fixture.provider.id,
					appRequestId: `quota_${crypto.randomUUID()}`,
					maxExpectedProviderRequests: 1,
					messages: [],
				});
				const { reservation } = yield* reserve;
				if (!reservation) {
					return yield* Effect.die("the first call was refused");
				}

				// The settle locks the ledger first, then writes an event of the period.
				const held = yield* heldLedger(
					reservation.poolId,
					settle === "finalize"
						? finalizeAppRequestQuota({
								reservation,
								steps: [
									{},
								],
							})
						: releaseAppRequestQuota({
								reservation,
								reason: "provider_failure",
							}),
				);
				const reserving = yield* Effect.forkChild(reserve);
				yield* held.finish;
				return yield* Fiber.join(reserving);
			}),
		);

		expect(second.allowed).toBe(true);
	},
);

/** The real clock moved on by `offset.ms`. */
const shiftedClock = (offset: { ms: number }) =>
	Effect.gen(function* () {
		const real = yield* Clock.Clock;
		const millis = () => real.currentTimeMillisUnsafe() + offset.ms;
		const nanos = () => BigInt(millis()) * 1_000_000n;
		return {
			currentTimeMillisUnsafe: millis,
			currentTimeMillis: Effect.sync(millis),
			currentTimeNanosUnsafe: nanos,
			currentTimeNanos: Effect.sync(nanos),
			monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
			monotonicTimeNanos: real.monotonicTimeNanos,
			sleep: (duration) => real.sleep(duration),
		} satisfies Clock.Clock;
	});

test("a reservation that waits past the end of its period lands on the next", async () => {
	const { ended, reservedOn, periods } = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const fixture = yield* organizationWithProvider();
			const { pool, period } = yield* fixture.createPool({});
			yield* db
				.update(dbSchema.quotaPeriod)
				.set({
					endsAt: new Date(Date.now() + 60_000),
				})
				.where(eq(dbSchema.quotaPeriod.id, period.id));
			const offset = {
				ms: 0,
			};
			const clock = yield* shiftedClock(offset);

			const held = yield* heldLedger(pool.id, Effect.void);
			const reserving = yield* reserveForAppRequest({
				organizationId: fixture.organization.id,
				userId: fixture.user.id,
				providerId: fixture.provider.id,
				appRequestId: `quota_${crypto.randomUUID()}`,
				maxExpectedProviderRequests: 1,
				messages: [],
			}).pipe(Effect.provideService(Clock.Clock, clock), Effect.forkChild);
			yield* awaitLockWaiters("%quota_ledger%for update%");
			// The period ends while the reservation waits.
			offset.ms = 120_000;
			yield* held.finish;
			const { reservation } = yield* Fiber.join(reserving);
			return {
				ended: period.id,
				reservedOn: reservation?.periodId,
				periods: yield* periodsOf(pool.id),
			};
		}),
	);

	expect(periods.find((period) => period.id === ended)?.status).toBe("closed");
	expect(periods.find((period) => period.status === "open")).toMatchObject({
		id: reservedOn,
	});
});
