import { expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import {
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { STALE_RESERVATION_AGE_MS } from "../src/call-timeout";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "../src/enforcement";
import {
	createQuotaPoolWithInitialPeriod,
	releaseStaleQuotaReservations,
} from "../src/ledger";

const runtime = integrationRuntime();

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
			const { pool, period } = yield* createQuotaPoolWithInitialPeriod({
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
			const reserve = (amount: number) =>
				runtime.runPromise(
					reserveForAppRequest({
						organizationId: organization.id,
						userId: user.id,
						providerId: provider.id,
						appRequestId: `quota_${crypto.randomUUID()}`,
						maxExpectedProviderRequests: amount,
						maxExpectedOutputTokens: amount,
						messages: [],
					}),
				);
			const ledger = () =>
				runtime.runPromise(
					Effect.gen(function* () {
						const [row] = yield* (yield* DB)
							.select()
							.from(dbSchema.quotaLedger)
							.where(
								and(
									eq(dbSchema.quotaLedger.quotaPoolId, pool.id),
									eq(dbSchema.quotaLedger.quotaPeriodId, period.id),
								),
							);
						return row;
					}),
				);
			return {
				reserve,
				ledger,
			};
		}),
	);

const granted = (
	result: Effect.Success<ReturnType<typeof reserveForAppRequest>>,
) => (result.allowed ? (result.reservation?.reservedAmount ?? 0) : 0);

const requestPool = (budgetAmount: number) =>
	pool({
		budgetAmount,
		meteringMode: "requests",
	});

test("concurrent calls are granted the budget and no more", async () => {
	const { reserve, ledger } = await requestPool(10);

	const results = await Promise.all(
		Array.from(
			{
				length: 15,
			},
			() => reserve(1),
		),
	);

	expect(results.map(granted).reduce((sum, amount) => sum + amount)).toBe(10);
	expect(results.filter((result) => !result.allowed)).toHaveLength(5);
	expect(results.find((result) => !result.allowed)?.denialReason).toBe(
		"exhausted",
	);
	expect(await ledger()).toMatchObject({
		reservedAmount: 10,
		remainingAmount: 0,
	});
});

test("a request-metered call is granted what remains when less than it asks", async () => {
	const { reserve } = await requestPool(10);
	await reserve(7);

	expect(granted(await reserve(25))).toBe(3);
	expect((await reserve(1)).allowed).toBe(false);
});

test("a token-metered call is refused unless all it asks remains", async () => {
	const { reserve, ledger } = await pool({
		budgetAmount: 1000,
		meteringMode: "tokens",
	});

	const result = await reserve(1000);

	expect(result).toEqual({
		allowed: false,
		denialReason: "exhausted",
	});
	expect(await ledger()).toMatchObject({
		reservedAmount: 0,
		remainingAmount: 1000,
	});
});

test("a finalized call charges what it used and frees the rest", async () => {
	const { reserve } = await requestPool(10);
	const first = await reserve(6);
	if (!first.reservation) throw new Error("first call refused");

	await runtime.runPromise(
		finalizeAppRequestQuota({
			reservation: first.reservation,
			actualRequestCount: 2,
		}),
	);

	expect(granted(await reserve(10))).toBe(8);
});

test("a released call frees all it reserved", async () => {
	const { reserve } = await requestPool(10);
	await reserve(4);
	const second = await reserve(6);
	if (!second.reservation) throw new Error("second call refused");

	await runtime.runPromise(
		releaseAppRequestQuota({
			reservation: second.reservation,
			reason: "provider_failure",
		}),
	);

	expect(granted(await reserve(10))).toBe(6);
});

// Also releases whatever else in the database went stale.
test("a reservation older than any call can run is released", async () => {
	const { reserve, ledger } = await requestPool(10);
	const stale = await reserve(6);
	if (!stale.reservation) throw new Error("call refused");
	await reserve(3);
	await runtime.runPromise(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.quotaUsageEvent)
				.set({
					occurredAt: new Date(Date.now() - STALE_RESERVATION_AGE_MS - 60_000),
				})
				.where(
					eq(
						dbSchema.quotaUsageEvent.reservationKey,
						stale.reservation?.reservationKey ?? "",
					),
				);
		}),
	);

	await runtime.runPromise(
		releaseStaleQuotaReservations({
			reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
			limit: 500,
		}),
	);

	expect(await ledger()).toMatchObject({
		reservedAmount: 3,
		remainingAmount: 7,
	});
	// Settling it later changes nothing.
	await runtime.runPromise(
		finalizeAppRequestQuota({
			reservation: stale.reservation,
			actualRequestCount: 6,
		}),
	);
	expect((await ledger()).remainingAmount).toBe(7);
}, 30_000);
