import { describe, expect, test } from "bun:test";
import type {
	OrganizationId,
	QuotaPeriodId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import { ValkeyLive } from "@orcai/valkey";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { v4 as uuidv4 } from "uuid";
import { QuotaCounterStore, QuotaCounterStoreLive } from "../src/counter-store";

const reserve = (input: {
	remaining: number;
	amount: number;
	minimumAmount: number;
}) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const store = yield* QuotaCounterStore;
			const poolId = uuidv4() as QuotaPoolId;
			const periodId = uuidv4() as QuotaPeriodId;
			const result = yield* store.reserve({
				poolId,
				periodId,
				reservationKey: `test_${uuidv4()}`,
				amount: input.amount,
				minimumAmount: input.minimumAmount,
				initialState: {
					remaining: input.remaining,
					reserved: 0,
					consumed: 0,
				},
				meteringMode: "requests",
				userId: uuidv4() as UserId,
				organizationId: uuidv4() as OrganizationId,
			});
			const state = yield* store.getState({
				poolId,
				periodId,
			});
			return {
				result,
				state,
			};
		}).pipe(
			Effect.provide(QuotaCounterStoreLive.pipe(Layer.provide(ValkeyLive))),
		),
	);

describe("QuotaCounterStore.reserve", () => {
	test("grants the whole amount when enough remains", async () => {
		const { result, state } = await reserve({
			remaining: 30,
			amount: 25,
			minimumAmount: 1,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: 5,
			reservedAmount: 25,
		});
		expect(state).toEqual({
			remaining: 5,
			reserved: 25,
			consumed: 0,
		});
	});

	test("grants what remains when less than the amount is left", async () => {
		const { result, state } = await reserve({
			remaining: 3,
			amount: 25,
			minimumAmount: 1,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: 0,
			reservedAmount: 3,
		});
		expect(state.reserved).toBe(3);
	});

	test("refuses when nothing remains", async () => {
		const { result, state } = await reserve({
			remaining: 0,
			amount: 25,
			minimumAmount: 1,
		});

		expect(result).toEqual({
			allowed: false,
			remaining: 0,
			reservedAmount: 0,
		});
		expect(state.reserved).toBe(0);
	});

	test("refuses below the minimum, as token reservations ask for all", async () => {
		const { result, state } = await reserve({
			remaining: 3,
			amount: 25,
			minimumAmount: 25,
		});

		expect(result.allowed).toBe(false);
		expect(result.reservedAmount).toBe(0);
		expect(state).toEqual({
			remaining: 3,
			reserved: 0,
			consumed: 0,
		});
	});
});
