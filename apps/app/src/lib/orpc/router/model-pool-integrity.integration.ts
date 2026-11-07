import { expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { awaitLockWaiters, holdLock, rejection } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller } = appIntegration();

const setup = async () => {
	const {
		organizationId,
		actors: [admin],
		zedToken,
	} = await organizationWith([
		"admin",
	]);
	const [group] = await run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.group)
				.values({
					organizationId,
					name: "Pool group",
					kind: "custom",
					createdBy: admin.user.id,
				})
				.returning();
		}),
	);
	const p = await run(Procedures);
	const { call } = caller(zedToken);
	const provider = async (name: string) =>
		(
			await call(admin, (o) =>
				p.provider.create(
					{
						name,
						description: "",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "unused",
						meteringMode: "requests",
						enabled: true,
					},
					o,
				),
			)
		).data;
	const a = await provider("A");
	const b = await provider("B");
	const { data: model } = await call(admin, (o) =>
		p.model.create(
			{
				providerId: a.id,
				providerModelId: "test",
				name: "M",
				description: "",
				isDeprecated: false,
				capabilities: [
					"text",
				],
			},
			o,
		),
	);
	const createPool = () =>
		call(admin, (o) =>
			p.quotaPool.create(
				{
					name: `Model pool ${crypto.randomUUID()}`,
					providerId: a.id,
					modelId: model.id,
					periodType: "monthly",
					budgetAmount: 10,
					groupIds: [
						group.id,
					],
				},
				o,
			),
		);
	const move = (providerId: ProviderId) =>
		call(admin, (o) =>
			p.model.update(
				{
					id: model.id,
					providerId,
				},
				o,
			),
		);
	const remove = () =>
		call(admin, (o) =>
			p.model.delete(
				{
					refs: [
						{
							id: model.id,
						},
					],
				},
				o,
			),
		);
	return {
		a,
		b,
		model,
		createPool,
		move,
		remove,
	};
};

const stored = (modelId: ModelId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [model] = yield* db
				.select({
					providerId: dbSchema.model.providerId,
				})
				.from(dbSchema.model)
				.where(eq(dbSchema.model.id, modelId));
			const pools = yield* db
				.select({
					providerId: dbSchema.quotaPool.providerId,
				})
				.from(dbSchema.quotaPool)
				.where(eq(dbSchema.quotaPool.modelId, modelId));
			return {
				modelProvider: model?.providerId,
				poolProviders: pools.map((pool) => pool.providerId),
			};
		}),
	);

/** Queues both writes behind a held model-row lock, first before second. */
const overlap = async <A, B>(
	modelId: ModelId,
	first: () => Promise<A>,
	second: () => Promise<B>,
) => {
	const release = await run(
		holdLock(
			Effect.gen(function* () {
				yield* (yield* DB)
					.select()
					.from(dbSchema.model)
					.where(eq(dbSchema.model.id, modelId))
					.for("update");
			}),
		),
	);
	const settled = (promise: Promise<unknown>) =>
		promise.then(
			() => "ok" as const,
			(error: unknown) => error,
		);
	const writes: Promise<unknown>[] = [];
	try {
		writes.push(settled(first()));
		await run(awaitLockWaiters('%"model"%'));
		writes.push(settled(second()));
		await run(awaitLockWaiters('%"model"%', 2));
	} finally {
		await run(release);
	}
	return Promise.all(writes);
};

test(
	"moving a model referenced by a quota pool is refused and keeps the provider pair consistent",
	async () => {
		const { a, b, model, createPool, move } = await setup();
		await createPool();
		expect(await rejection(move(b.id))).toMatchObject({
			reason: "MODEL_IN_QUOTA_POOLS",
		});
		expect(await stored(model.id)).toEqual({
			modelProvider: a.id,
			poolProviders: [
				a.id,
			],
		});
	},
	TIMEOUT,
);

test(
	"a move queued behind a pool creation is refused",
	async () => {
		const { a, b, model, createPool, move } = await setup();
		const [created, moved] = await overlap(model.id, createPool, () =>
			move(b.id),
		);
		expect(created).toBe("ok");
		expect(moved).toMatchObject({
			reason: "MODEL_IN_QUOTA_POOLS",
		});
		expect(await stored(model.id)).toEqual({
			modelProvider: a.id,
			poolProviders: [
				a.id,
			],
		});
	},
	TIMEOUT,
);

test(
	"a pool creation queued behind a move is refused",
	async () => {
		const { b, model, createPool, move } = await setup();
		const [moved, created] = await overlap(
			model.id,
			() => move(b.id),
			createPool,
		);
		expect(moved).toBe("ok");
		expect(created).toMatchObject({
			reason: "MODEL_PROVIDER_MISMATCH",
		});
		expect(await stored(model.id)).toEqual({
			modelProvider: b.id,
			poolProviders: [],
		});
	},
	TIMEOUT,
);

test(
	"deleting a model keeps its pools for the whole provider",
	async () => {
		const { a, createPool, remove } = await setup();
		const { data: pool } = await createPool();
		await remove();
		const [kept] = await run(
			Effect.gen(function* () {
				return yield* (yield* DB)
					.select({
						providerId: dbSchema.quotaPool.providerId,
						modelId: dbSchema.quotaPool.modelId,
					})
					.from(dbSchema.quotaPool)
					.where(eq(dbSchema.quotaPool.id, pool.id));
			}),
		);
		expect(kept).toEqual({
			providerId: a.id,
			modelId: null,
		});
	},
	TIMEOUT,
);

test(
	"the database refuses a pool whose provider does not own its model",
	async () => {
		const { b, createPool } = await setup();
		const { data: pool } = await createPool();
		const failed = await run(
			Effect.gen(function* () {
				return yield* (yield* DB)
					.update(dbSchema.quotaPool)
					.set({
						providerId: b.id,
					})
					.where(eq(dbSchema.quotaPool.id, pool.id))
					.pipe(Effect.flip);
			}),
		);
		expect(JSON.stringify(failed)).toContain("quota_pool_provider_model_fk");
	},
	TIMEOUT,
);
