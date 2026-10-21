import { describe, expect, test } from "bun:test";
import type { BotId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ListBotsInput } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/**
 * An organization with an owner and a member; every call reads at the newest
 * zedToken any call has returned.
 */
const library = async () => {
	const {
		actors: [owner, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const prefix = crypto.randomUUID();

	const call = async <
		A extends {
			meta?: {
				zedToken?: string;
			};
		},
	>(
		actor: Actor,
		procedure: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<A, unknown, never>,
	) => {
		const output = await run(procedure(await procedureOptions(actor, token)));
		token = output.meta?.zedToken ?? token;
		return output;
	};

	const save = async (
		name: string,
		status: "draft" | "ready",
		id?: BotId,
	): Promise<BotId> => {
		const { data } = await call(owner, (options) =>
			procedures.bot.save(
				{
					id,
					name: `${prefix} ${name}`,
					description: "Integration bot",
					status,
				},
				options,
			),
		);
		return data.id;
	};

	const viewer = (botId: BotId) => ({
		resourceType: "bot" as const,
		resourceId: botId,
		principalType: "user" as const,
		principalId: member.user.id,
	});

	const grant = (botId: BotId) =>
		call(owner, (options) =>
			procedures.resource.grant(
				{
					resourceType: "bot",
					resourceId: botId,
					principals: [
						{
							principalType: "user",
							principalId: member.user.id,
						},
					],
					role: "viewer",
				},
				options,
			),
		);

	const revoke = (botId: BotId) =>
		call(owner, (options) =>
			procedures.resource.revoke(viewer(botId), options),
		);

	const setFavourite = (actor: Actor, botId: BotId, favourite: boolean) =>
		call(actor, (options) =>
			procedures.bot.setFavourite(
				{
					id: botId,
					favourite,
				},
				options,
			),
		);

	const remove = (botId: BotId) =>
		call(owner, (options) =>
			procedures.bot.delete(
				{
					refs: [
						{
							id: botId,
						},
					],
				},
				options,
			),
		);

	/** `name:isFavourite` of the actor's published bots from this library. */
	const list = async (
		actor: Actor,
		input: Partial<ListBotsInput> = {},
	): Promise<string[]> => {
		const { data } = await call(actor, (options) =>
			procedures.bot.list(
				{
					search: prefix,
					...input,
				},
				options,
			),
		);
		return data.map(
			(bot) => `${bot.name.slice(prefix.length + 1)}:${bot.isFavourite}`,
		);
	};

	const find = async (actor: Actor, botId: BotId) =>
		(
			await call(actor, (options) =>
				procedures.bot.find(
					{
						id: botId,
					},
					options,
				),
			)
		).data.isFavourite;

	const favouriteRows = (botId: BotId) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				return yield* db
					.select({
						userId: dbSchema.botFavourite.userId,
					})
					.from(dbSchema.botFavourite)
					.where(eq(dbSchema.botFavourite.botId, botId));
			}),
		);

	return {
		owner,
		member,
		prefix,
		call,
		procedures,
		save,
		grant,
		revoke,
		setFavourite,
		remove,
		list,
		find,
		favouriteRows,
	};
};

describe("setFavourite", () => {
	test(
		"is idempotent both ways",
		async () => {
			const { owner, save, setFavourite, list, find, favouriteRows } =
				await library();
			const botId = await save("Alpha", "ready");

			await setFavourite(owner, botId, true);
			await setFavourite(owner, botId, true);
			expect(await favouriteRows(botId)).toHaveLength(1);
			expect(await list(owner)).toEqual([
				"Alpha:true",
			]);
			expect(await find(owner, botId)).toBe(true);

			await setFavourite(owner, botId, false);
			await setFavourite(owner, botId, false);
			expect(await favouriteRows(botId)).toHaveLength(0);
			expect(await list(owner)).toEqual([
				"Alpha:false",
			]);
			expect(await find(owner, botId)).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"requires read on the bot",
		async () => {
			const { member, save, setFavourite, favouriteRows } = await library();
			const botId = await save("Hidden", "ready");

			expect(await rejection(setFavourite(member, botId, true))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await favouriteRows(botId)).toHaveLength(0);
		},
		TIMEOUT,
	);

	test(
		"is rejected for a draft",
		async () => {
			const { owner, save, setFavourite, favouriteRows } = await library();
			const botId = await save("Draft", "draft");

			expect(await rejection(setFavourite(owner, botId, true))).toMatchObject({
				reason: "BOT_NOT_PUBLISHED",
			});
			expect(await favouriteRows(botId)).toHaveLength(0);
		},
		TIMEOUT,
	);
});

describe("favourites are filtered at read time", () => {
	test(
		"a favourite is hidden while access is revoked and back after a re-grant",
		async () => {
			const { member, save, grant, revoke, setFavourite, list, favouriteRows } =
				await library();
			const botId = await save("Shared", "ready");
			await grant(botId);
			await setFavourite(member, botId, true);

			await revoke(botId);
			expect(
				await list(member, {
					filters: {
						favourite: true,
					},
				}),
			).toEqual([]);
			expect(await favouriteRows(botId)).toHaveLength(1);

			await grant(botId);
			expect(
				await list(member, {
					filters: {
						favourite: true,
					},
				}),
			).toEqual([
				"Shared:true",
			]);
		},
		TIMEOUT,
	);

	test(
		"a favourite is hidden while its bot is unpublished",
		async () => {
			const { owner, save, setFavourite, list, find } = await library();
			const botId = await save("Toggled", "ready");
			await setFavourite(owner, botId, true);

			await save("Toggled", "draft", botId);
			expect(
				await list(owner, {
					filters: {
						favourite: true,
					},
				}),
			).toEqual([]);
			expect(await find(owner, botId)).toBe(false);

			await save("Toggled", "ready", botId);
			expect(await find(owner, botId)).toBe(true);
		},
		TIMEOUT,
	);

	test(
		"deleting a bot deletes its favourites",
		async () => {
			const { owner, save, setFavourite, remove, favouriteRows } =
				await library();
			const botId = await save("Doomed", "ready");
			await setFavourite(owner, botId, true);

			await remove(botId);
			expect(await favouriteRows(botId)).toHaveLength(0);
		},
		TIMEOUT,
	);
});

describe("list", () => {
	test(
		"filters by favourite",
		async () => {
			const { owner, save, setFavourite, list } = await library();
			const favouriteId = await save("Bravo", "ready");
			await save("Alpha", "ready");
			await setFavourite(owner, favouriteId, true);

			expect(
				await list(owner, {
					filters: {
						favourite: true,
					},
				}),
			).toEqual([
				"Bravo:true",
			]);
			expect(
				await list(owner, {
					filters: {
						favourite: false,
					},
				}),
			).toEqual([
				"Alpha:false",
			]);
		},
		TIMEOUT,
	);

	test(
		"sorts favourites first, then by name",
		async () => {
			const { owner, save, setFavourite, list } = await library();
			await save("Alpha", "ready");
			const delta = await save("Delta", "ready");
			await save("Bravo", "ready");
			const charlie = await save("Charlie", "ready");
			await setFavourite(owner, delta, true);
			await setFavourite(owner, charlie, true);

			expect(await list(owner)).toEqual([
				"Alpha:false",
				"Bravo:false",
				"Charlie:true",
				"Delta:true",
			]);
			expect(
				await list(owner, {
					sort: "favouritesFirst",
				}),
			).toEqual([
				"Charlie:true",
				"Delta:true",
				"Alpha:false",
				"Bravo:false",
			]);
		},
		TIMEOUT,
	);

	test(
		"breaks name ties by id",
		async () => {
			const { owner, prefix, call, procedures, save } = await library();
			const ids = [
				await save("Twin", "ready"),
				await save("Twin", "ready"),
			].sort();

			const { data } = await call(owner, (options) =>
				procedures.bot.list(
					{
						search: prefix,
						sort: "favouritesFirst",
					},
					options,
				),
			);
			expect(data.map((bot) => bot.id)).toEqual(ids);
		},
		TIMEOUT,
	);

	test(
		"reports only the caller's favourites",
		async () => {
			const { owner, member, save, grant, setFavourite, list, find } =
				await library();
			const botId = await save("Shared", "ready");
			await grant(botId);
			await setFavourite(owner, botId, true);

			expect(await list(member)).toEqual([
				"Shared:false",
			]);
			expect(await find(member, botId)).toBe(false);
			expect(
				await list(member, {
					filters: {
						favourite: true,
					},
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});
