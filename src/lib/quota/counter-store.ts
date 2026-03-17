import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type ValkeyClient, ValkeyService } from "@/lib/effect/services/valkey";
import { InternalError } from "@/lib/effect/utils/errors";

type ReservationStatus = "pending" | "reserved" | "finalized" | "released";

interface ReservationRecord {
	poolId: string;
	periodId: string;
	reservedAmount: number;
	status: ReservationStatus;
	meteringMode: "tokens" | "requests";
	userId: string;
	orgId: string;
	createdAt: string;
	actualAmount?: number;
}

const DAYS_30_SECONDS = 30 * 24 * 60 * 60;

const makeCounterKeys = (poolId: string, periodId: string) => ({
	remaining: `quota:${poolId}:${periodId}:remaining`,
	reserved: `quota:${poolId}:${periodId}:reserved`,
	consumed: `quota:${poolId}:${periodId}:consumed`,
});

const makeReservationKey = (reservationKey: string) =>
	`quota:reservation:${reservationKey}`;

const INIT_COUNTERS_SCRIPT = `
local remainingKey = KEYS[1]
local reservedKey = KEYS[2]
local consumedKey = KEYS[3]
local ttl = tonumber(ARGV[4])

if redis.call("EXISTS", remainingKey) == 0 then
  redis.call("SET", remainingKey, ARGV[1], "EX", ttl)
end
if redis.call("EXISTS", reservedKey) == 0 then
  redis.call("SET", reservedKey, ARGV[2], "EX", ttl)
end
if redis.call("EXISTS", consumedKey) == 0 then
  redis.call("SET", consumedKey, ARGV[3], "EX", ttl)
end
return 1
`;

const RESERVE_COUNTERS_SCRIPT = `
local remainingKey = KEYS[1]
local reservedKey = KEYS[2]
local amount = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local remaining = tonumber(redis.call("GET", remainingKey) or "0")

if remaining < amount then
  return {0, remaining}
end

local nextRemaining = remaining - amount
redis.call("SET", remainingKey, tostring(nextRemaining), "EX", ttl)
redis.call("SET", reservedKey, tostring(tonumber(redis.call("GET", reservedKey) or "0") + amount), "EX", ttl)
return {1, nextRemaining}
`;

const parseNumber = (value: string | null | undefined) => {
	if (value === null || value === undefined) {
		return 0;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const parseReservationRecord = (
	value: string | null,
): ReservationRecord | undefined => {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as ReservationRecord;
	} catch {
		return undefined;
	}
};

const setInitialCounterState = async (params: {
	client: ValkeyClient;
	poolId: string;
	periodId: string;
	remaining: number;
	reserved: number;
	consumed: number;
}) => {
	const keys = makeCounterKeys(params.poolId, params.periodId);

	await params.client.eval(INIT_COUNTERS_SCRIPT, {
		keys: [
			keys.remaining,
			keys.reserved,
			keys.consumed,
		],
		arguments: [
			String(Math.max(0, params.remaining)),
			String(Math.max(0, params.reserved)),
			String(Math.max(0, params.consumed)),
			String(DAYS_30_SECONDS),
		],
	});
};

const reserveCountersAtomically = async (params: {
	client: ValkeyClient;
	poolId: string;
	periodId: string;
	amount: number;
}) => {
	const keys = makeCounterKeys(params.poolId, params.periodId);
	const result = await params.client.eval(RESERVE_COUNTERS_SCRIPT, {
		keys: [
			keys.remaining,
			keys.reserved,
		],
		arguments: [
			String(params.amount),
			String(DAYS_30_SECONDS),
		],
	});

	if (!Array.isArray(result) || result.length < 2) {
		return {
			allowed: false,
			remaining: parseNumber(await params.client.get(keys.remaining)),
		};
	}

	return {
		allowed: Number(result[0]) === 1,
		remaining: Number.isFinite(Number(result[1]))
			? Number(result[1])
			: parseNumber(await params.client.get(keys.remaining)),
	};
};

export class QuotaCounterStore extends Context.Tag("QuotaCounterStore")<
	QuotaCounterStore,
	{
		readonly reserve: (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
			amount: number;
			initialState: {
				remaining: number;
				reserved: number;
				consumed: number;
			};
			meteringMode: "tokens" | "requests";
			userId: string;
			orgId: string;
		}) => Effect.Effect<
			{
				allowed: boolean;
				remaining: number;
			},
			InternalError,
			never
		>;
		readonly finalize: (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
			actualAmount: number;
		}) => Effect.Effect<void, InternalError, never>;
		readonly release: (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
		}) => Effect.Effect<void, InternalError, never>;
		readonly getState: (input: {
			poolId: string;
			periodId: string;
		}) => Effect.Effect<
			{
				reserved: number;
				consumed: number;
				remaining: number;
			},
			InternalError,
			never
		>;
		readonly overwriteState: (input: {
			poolId: string;
			periodId: string;
			reserved: number;
			consumed: number;
			remaining: number;
		}) => Effect.Effect<void, InternalError, never>;
	}
>() {}

export const QuotaCounterStoreLive = Layer.effect(
	QuotaCounterStore,
	Effect.gen(function* () {
		const { client } = yield* ValkeyService;

		const reserve = (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
			amount: number;
			initialState: {
				remaining: number;
				reserved: number;
				consumed: number;
			};
			meteringMode: "tokens" | "requests";
			userId: string;
			orgId: string;
		}) =>
			Effect.tryPromise({
				try: async () => {
					await setInitialCounterState({
						client,
						poolId: input.poolId,
						periodId: input.periodId,
						remaining: input.initialState.remaining,
						reserved: input.initialState.reserved,
						consumed: input.initialState.consumed,
					});

					const reservationStorageKey = makeReservationKey(
						input.reservationKey,
					);
					const existingRecord = parseReservationRecord(
						await client.get(reservationStorageKey),
					);

					if (existingRecord?.status === "reserved") {
						const keys = makeCounterKeys(input.poolId, input.periodId);
						return {
							allowed: true,
							remaining: parseNumber(await client.get(keys.remaining)),
						};
					}

					if (existingRecord?.status === "finalized") {
						const keys = makeCounterKeys(input.poolId, input.periodId);
						return {
							allowed: true,
							remaining: parseNumber(await client.get(keys.remaining)),
						};
					}

					const pendingRecord: ReservationRecord = {
						poolId: input.poolId,
						periodId: input.periodId,
						reservedAmount: input.amount,
						status: "pending",
						meteringMode: input.meteringMode,
						userId: input.userId,
						orgId: input.orgId,
						createdAt: new Date().toISOString(),
					};

					const pendingSet = await client.set(
						reservationStorageKey,
						JSON.stringify(pendingRecord),
						{
							condition: "NX",
							expiration: {
								type: "EX",
								value: DAYS_30_SECONDS,
							},
						},
					);

					if (pendingSet !== "OK") {
						const keys = makeCounterKeys(input.poolId, input.periodId);
						return {
							allowed: true,
							remaining: parseNumber(await client.get(keys.remaining)),
						};
					}

					const reserved = await reserveCountersAtomically({
						client,
						poolId: input.poolId,
						periodId: input.periodId,
						amount: input.amount,
					});

					if (!reserved.allowed) {
						await client.del(reservationStorageKey);
						return {
							allowed: false,
							remaining: reserved.remaining,
						};
					}

					await client.set(
						reservationStorageKey,
						JSON.stringify({
							...pendingRecord,
							status: "reserved",
						} satisfies ReservationRecord),
						{
							expiration: {
								type: "EX",
								value: DAYS_30_SECONDS,
							},
						},
					);

					return {
						allowed: true,
						remaining: reserved.remaining,
					};
				},
				catch: (cause) =>
					new InternalError({
						operation: "quotaCounterStore.reserve",
						cause,
					}),
			});

		const finalize = (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
			actualAmount: number;
		}) =>
			Effect.tryPromise({
				try: async () => {
					const reservationStorageKey = makeReservationKey(
						input.reservationKey,
					);
					const reservation = parseReservationRecord(
						await client.get(reservationStorageKey),
					);

					if (!reservation || reservation.status === "released") {
						return;
					}

					if (reservation.status === "finalized") {
						return;
					}

					const diff = reservation.reservedAmount - input.actualAmount;
					const keys = makeCounterKeys(input.poolId, input.periodId);
					await client
						.multi()
						.decrBy(keys.reserved, reservation.reservedAmount)
						.incrBy(keys.consumed, input.actualAmount)
						.incrBy(keys.remaining, diff)
						.set(
							reservationStorageKey,
							JSON.stringify({
								...reservation,
								status: "finalized",
								actualAmount: input.actualAmount,
							} satisfies ReservationRecord),
							{
								expiration: {
									type: "EX",
									value: DAYS_30_SECONDS,
								},
							},
						)
						.exec();

					// Floor counters to 0 — drift from expired keys can cause negatives
					const [remaining, reserved] = await Promise.all([
						client.get(keys.remaining),
						client.get(keys.reserved),
					]);
					const fixes: Promise<unknown>[] = [];
					if (parseNumber(remaining) < 0) {
						fixes.push(
							client.set(keys.remaining, "0", {
								expiration: "KEEPTTL",
							}),
						);
					}
					if (parseNumber(reserved) < 0) {
						fixes.push(
							client.set(keys.reserved, "0", {
								expiration: "KEEPTTL",
							}),
						);
					}
					if (fixes.length > 0) {
						await Promise.all(fixes);
					}
				},
				catch: (cause) =>
					new InternalError({
						operation: "quotaCounterStore.finalize",
						cause,
					}),
			});

		const release = (input: {
			poolId: string;
			periodId: string;
			reservationKey: string;
		}) =>
			Effect.tryPromise({
				try: async () => {
					const reservationStorageKey = makeReservationKey(
						input.reservationKey,
					);
					const reservation = parseReservationRecord(
						await client.get(reservationStorageKey),
					);

					if (!reservation || reservation.status === "released") {
						return;
					}

					if (reservation.status === "finalized") {
						return;
					}

					const keys = makeCounterKeys(input.poolId, input.periodId);
					await client
						.multi()
						.decrBy(keys.reserved, reservation.reservedAmount)
						.incrBy(keys.remaining, reservation.reservedAmount)
						.set(
							reservationStorageKey,
							JSON.stringify({
								...reservation,
								status: "released",
							} satisfies ReservationRecord),
							{
								expiration: {
									type: "EX",
									value: DAYS_30_SECONDS,
								},
							},
						)
						.exec();

					// Floor reserved to 0 — drift from expired keys can cause negatives
					const reservedAfter = parseNumber(await client.get(keys.reserved));
					if (reservedAfter < 0) {
						await client.set(keys.reserved, "0", {
							expiration: "KEEPTTL",
						});
					}
				},
				catch: (cause) =>
					new InternalError({
						operation: "quotaCounterStore.release",
						cause,
					}),
			});

		const getState = (input: { poolId: string; periodId: string }) =>
			Effect.tryPromise({
				try: async () => {
					const keys = makeCounterKeys(input.poolId, input.periodId);
					const [remaining, reserved, consumed] = await Promise.all([
						client.get(keys.remaining),
						client.get(keys.reserved),
						client.get(keys.consumed),
					]);

					return {
						remaining: parseNumber(remaining),
						reserved: parseNumber(reserved),
						consumed: parseNumber(consumed),
					};
				},
				catch: (cause) =>
					new InternalError({
						operation: "quotaCounterStore.getState",
						cause,
					}),
			});

		const overwriteState = (input: {
			poolId: string;
			periodId: string;
			reserved: number;
			consumed: number;
			remaining: number;
		}) =>
			Effect.tryPromise({
				try: async () => {
					const keys = makeCounterKeys(input.poolId, input.periodId);
					await client
						.multi()
						.set(keys.remaining, String(Math.max(0, input.remaining)), {
							expiration: {
								type: "EX",
								value: DAYS_30_SECONDS,
							},
						})
						.set(keys.reserved, String(Math.max(0, input.reserved)), {
							expiration: {
								type: "EX",
								value: DAYS_30_SECONDS,
							},
						})
						.set(keys.consumed, String(Math.max(0, input.consumed)), {
							expiration: {
								type: "EX",
								value: DAYS_30_SECONDS,
							},
						})
						.exec();
				},
				catch: (cause) =>
					new InternalError({
						operation: "quotaCounterStore.overwriteState",
						cause,
					}),
			});

		return {
			reserve,
			finalize,
			release,
			getState,
			overwriteState,
		};
	}),
);
