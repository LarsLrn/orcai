import { expect, test } from "bun:test";
import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { createQuotaPoolWithInitialPeriod } from "../src/ledger";
import { updateQuotaPool } from "../src/pool-management";

const runtime = integrationRuntime();

test("an update that fails part way changes nothing", async () => {
	const { pool, unchanged, ledger } = await runtime.runPromise(
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
			const { pool } = yield* createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Before",
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: 10,
				priority: 0,
				isDefault: false,
				createdByUserId: user.id,
				assignedGroupIds: [],
			});
			// The audit entry names an actor that does not exist, so its insert fails last.
			const failed = yield* updateQuotaPool({
				id: pool.id,
				organizationId: organization.id,
				actorUserId: crypto.randomUUID() as UserId,
				name: "After",
				budgetAmount: 20,
			}).pipe(Effect.flip);
			expect(failed).toBeDefined();
			const [unchanged] = yield* db
				.select()
				.from(dbSchema.quotaPool)
				.where(eq(dbSchema.quotaPool.id, pool.id));
			const [ledger] = yield* db
				.select({
					budgetAmount: dbSchema.quotaLedger.budgetAmount,
				})
				.from(dbSchema.quotaLedger)
				.where(eq(dbSchema.quotaLedger.quotaPoolId, pool.id));
			return {
				pool,
				unchanged,
				ledger,
			};
		}),
	);

	expect(unchanged).toMatchObject({
		name: pool.name,
		budgetAmount: pool.budgetAmount,
	});
	expect(ledger?.budgetAmount).toBe(pool.budgetAmount);
});
