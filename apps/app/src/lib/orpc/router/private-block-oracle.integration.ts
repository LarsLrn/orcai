// A4: inaccessible and absent linked blocks must have indistinguishable errors.
import { expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller } = appIntegration();

/** The refusal as a client receives it; the HTTP status follows the code. */
const publicRefusal = (error: unknown) =>
	run(mapEffectErrors(Effect.fail(error))).then(
		() => undefined,
		(mapped: ORPCError<string, unknown>) => mapped.toJSON(),
	);

const botsNamed = (name: string) =>
	run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select({
					id: dbSchema.bot.id,
				})
				.from(dbSchema.bot)
				.where(eq(dbSchema.bot.name, name));
		}),
	);
test(
	"bot creation gives the same public refusal for absent and private blocks of either type",
	async () => {
		const {
			actors: [owner],
			zedToken,
		} = await organizationWith([
			"member",
		]);
		const {
			actors: [outsider],
			zedToken: otherToken,
		} = await organizationWith([
			"member",
		]);
		const p = await run(Procedures);
		const { call } = caller(zedToken);
		const other = caller(otherToken);
		const { data: behaviour } = await call(owner, (o) =>
			p.block.create(
				{
					type: "behaviour",
					name: "Private",
					description: null,
					contentJson: null,
					status: "ready",
					config: {
						systemPrompt: "",
					},
				},
				o,
			),
		);
		const { data: repository } = await call(owner, (o) =>
			p.block.create(
				{
					type: "repository",
					name: "Private repository",
					description: null,
					contentJson: null,
					status: "ready",
					assets: [],
					config: {
						minPassages: 1,
						maxPassages: 5,
						defaultPassages: 3,
					},
				},
				o,
			),
		);
		const errors = [];
		for (const id of [
			behaviour.id,
			repository.id,
			crypto.randomUUID() as BlockId,
		]) {
			expect(
				await other
					.call(outsider, (o) =>
						p.block.find(
							{
								id,
							},
							o,
						),
					)
					.then(
						() => false,
						() => true,
					),
			).toBe(true);
			const name = `Oracle ${crypto.randomUUID()}`;
			const error = await other
				.call(outsider, (o) =>
					p.bot.save(
						{
							name,
							description: "Integration bot",
							status: "draft",
							behaviourId: id,
						},
						o,
					),
				)
				.then(
					() => undefined,
					(e: unknown) => e,
				);
			errors.push(await publicRefusal(error));
			expect(await botsNamed(name)).toEqual([]);
		}
		expect(errors[0]).toMatchObject({
			code: "FORBIDDEN",
			data: {
				reason: "BLOCK_LINK_FORBIDDEN",
			},
		});
		expect(errors).toEqual([
			errors[0],
			errors[0],
			errors[0],
		]);
	},
	TIMEOUT,
);

test(
	"bot creation still names the wrong type of a block the editor may link",
	async () => {
		const {
			actors: [owner],
			zedToken,
		} = await organizationWith([
			"member",
		]);
		const p = await run(Procedures);
		const { call } = caller(zedToken);
		const { data: repository } = await call(owner, (o) =>
			p.block.create(
				{
					type: "repository",
					name: "Own repository",
					description: null,
					contentJson: null,
					status: "ready",
					assets: [],
					config: {
						minPassages: 1,
						maxPassages: 5,
						defaultPassages: 3,
					},
				},
				o,
			),
		);
		const error = await call(owner, (o) =>
			p.bot.save(
				{
					name: `Wrong type ${crypto.randomUUID()}`,
					description: "Integration bot",
					status: "draft",
					behaviourId: repository.id,
				},
				o,
			),
		).then(
			() => undefined,
			(e: unknown) => e,
		);
		expect(error).toMatchObject({
			reason: "BEHAVIOUR_BLOCK_TYPE_INVALID",
		});
	},
	TIMEOUT,
);
