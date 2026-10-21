import { expect, test } from "bun:test";
import type { QuotaPeriodId, QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	createQuotaPoolWithInitialPeriod,
	finalizeQuotaLedger,
	reconcileQuotaLedger,
	reserveQuotaLedger,
} from "../src/ledger";

const runtime = integrationRuntime();

/** A 1000-token pool with one finalized call (100 reserved, 40 used) and one in flight (50). */
const poolWithUsage = () =>
	runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const { organization } = yield* createOrganization();
			const [provider] = yield* db
				.insert(dbSchema.provider)
				.values({
					organizationId: organization.id,
					name: "Ledger provider",
					kind: "openai",
					description: "",
					apiKeyEncrypted: "unused",
				})
				.returning();
			const { pool, period } = yield* createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Ledger pool",
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: 1000,
				priority: 0,
				isDefault: true,
				createdByUserId: user.id,
				assignedGroupIds: [],
			});
			const reserve = (reservationKey: string, reservedAmount: number) =>
				reserveQuotaLedger({
					organizationId: organization.id,
					quotaPoolId: pool.id,
					quotaPeriodId: period.id,
					providerId: provider.id,
					userId: user.id,
					appRequestId: reservationKey,
					reservationKey,
					meteringMode: "tokens",
					reservedAmount,
				});
			const suffix = crypto.randomUUID();
			yield* reserve(`done_${suffix}`, 100);
			yield* finalizeQuotaLedger({
				reservationKey: `done_${suffix}`,
				appRequestId: `done_${suffix}`,
				actualAmount: 40,
			});
			yield* reserve(`open_${suffix}`, 50);
			return {
				quotaPoolId: pool.id,
				quotaPeriodId: period.id,
			};
		}),
	);

const ledgerOf = (ids: {
	quotaPoolId: QuotaPoolId;
	quotaPeriodId: QuotaPeriodId;
}) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const [ledger] = yield* (yield* DB)
				.select()
				.from(dbSchema.quotaLedger)
				.where(
					and(
						eq(dbSchema.quotaLedger.quotaPoolId, ids.quotaPoolId),
						eq(dbSchema.quotaLedger.quotaPeriodId, ids.quotaPeriodId),
					),
				);
			return ledger;
		}),
	);

const expected = {
	reserved: 50,
	consumed: 40,
	remaining: 910,
};

test("a ledger that drifted from its events is corrected to them", async () => {
	const ids = await poolWithUsage();
	await runtime.runPromise(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.quotaLedger)
				.set({
					reservedAmount: 0,
					consumedAmount: 500,
					remainingAmount: 500,
				})
				.where(
					and(
						eq(dbSchema.quotaLedger.quotaPoolId, ids.quotaPoolId),
						eq(dbSchema.quotaLedger.quotaPeriodId, ids.quotaPeriodId),
					),
				);
		}),
	);

	const reconciled = await runtime.runPromise(reconcileQuotaLedger(ids));

	expect(reconciled).toEqual({
		before: {
			reserved: 0,
			consumed: 500,
			remaining: 500,
		},
		after: expected,
	});
	expect(await ledgerOf(ids)).toMatchObject({
		reservedAmount: 50,
		consumedAmount: 40,
		remainingAmount: 910,
	});
});

test("a ledger that matches its events is left alone", async () => {
	const ids = await poolWithUsage();
	const { version } = await ledgerOf(ids);

	const reconciled = await runtime.runPromise(reconcileQuotaLedger(ids));

	expect(reconciled).toEqual({
		before: expected,
		after: expected,
	});
	expect((await ledgerOf(ids)).version).toBe(version);
});
