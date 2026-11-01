import { describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { LibraryEntry } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { type Actor, TIMEOUT } from "@/lib/authz/authz-integration";
import { libraryIntegration } from "@/lib/library/library-integration";

const { run, procedureOptions, organization, countingStatements } =
	libraryIntegration();

const entryName = (entry: LibraryEntry) =>
	entry.kind === "bot"
		? entry.bot.name
		: entry.kind === "block"
			? entry.block.name
			: entry.asset.title;

/** `organization()` plus makers for bots, repositories and titled assets. */
const stocked = async () => {
	const fixture = await organization();
	const { procedures, call, asset } = fixture;
	const tag = crypto.randomUUID();

	const bot = async (
		owner: Actor,
		name: string,
		status: "ready" | "draft" = "ready",
	) =>
		(
			await call(owner, (options) =>
				procedures.bot.save(
					{
						name,
						description: "Integration bot",
						status,
					},
					options,
				),
			)
		).data.id;
	const repository = async (owner: Actor, name: string) =>
		(
			await call(owner, (options) =>
				procedures.block.create(
					{
						type: "repository",
						name,
						description: null,
						contentJson: null,
						status: "ready",
						config: {
							minPassages: 1,
							maxPassages: 5,
							defaultPassages: 3,
						},
					},
					options,
				),
			)
		).data.id;
	const titled = async (
		owner: Actor,
		title: string,
		keptIn: "library" | "chat" = "library",
	) => {
		const id: AssetId = await asset(owner);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						title,
						keptIn,
					})
					.where(eq(dbSchema.asset.id, id));
			}),
		);
		return id;
	};

	/** Lets the member read what the admin made. */
	const shown = async <Id extends string>(
		resourceType: "bot" | "block",
		created: Promise<Id>,
	) => {
		const resourceId = await created;
		await fixture.share(
			{
				resourceType,
				resourceId,
			},
			"viewer",
			fixture.toMember,
		);
		return resourceId;
	};

	return {
		...fixture,
		tag,
		bot,
		repository,
		titled,
		shown,
	};
};

describe("library browse", () => {
	test(
		"counts follow scope and search; drafts count for editors only",
		async () => {
			const {
				admin,
				member,
				procedures,
				call,
				tag,
				bot,
				behaviour,
				repository,
				titled,
				shown,
			} = await stocked();
			await shown("bot", bot(admin, `Alpha bot ${tag}`));
			await shown("bot", bot(admin, `Admin draft bot ${tag}`, "draft"));
			await bot(member, `Member draft bot ${tag}`, "draft");
			await shown("block", behaviour(admin, `Alpha behaviour ${tag}`));
			await shown(
				"block",
				behaviour(admin, `Admin draft behaviour ${tag}`, "draft"),
			);
			await repository(member, `Beta repository ${tag}`);
			await titled(member, `Alpha asset ${tag}`);
			await titled(member, `Chat asset ${tag}`, "chat");

			const counts = (
				actor: Actor,
				input: Parameters<typeof procedures.library.counts>[0],
			) =>
				call(actor, (options) =>
					procedures.library.counts(input, options),
				).then(({ data }) => data);

			expect(await counts(member, {})).toEqual({
				bot: 2,
				behaviour: 1,
				repository: 1,
				asset: 1,
			});
			expect(
				await counts(member, {
					scope: "edit",
				}),
			).toEqual({
				bot: 1,
				behaviour: 0,
				repository: 1,
				asset: 1,
			});
			expect(
				await counts(member, {
					search: "alpha",
				}),
			).toEqual({
				bot: 1,
				behaviour: 1,
				repository: 0,
				asset: 1,
			});
		},
		TIMEOUT,
	);

	test(
		"search orders every kind in one list and pages it once",
		async () => {
			const {
				admin,
				member,
				procedures,
				call,
				tag,
				bot,
				behaviour,
				repository,
				titled,
				shown,
			} = await stocked();
			await titled(member, `D asset ${tag}`);
			await shown("bot", bot(admin, `B bot ${tag}`));
			await repository(member, `E repository ${tag}`);
			await shown("block", behaviour(admin, `A behaviour ${tag}`));
			await bot(member, `C draft bot ${tag}`, "draft");
			await shown("bot", bot(admin, `F hidden draft ${tag}`, "draft"));
			await titled(member, `G chat asset ${tag}`, "chat");

			const search = (
				actor: Actor,
				input: Partial<Parameters<typeof procedures.library.search>[0]>,
			) =>
				call(actor, (options) =>
					procedures.library.search(
						{
							search: tag,
							...input,
						},
						options,
					),
				);
			const byName = [
				`A behaviour ${tag}`,
				`B bot ${tag}`,
				`C draft bot ${tag}`,
				`D asset ${tag}`,
				`E repository ${tag}`,
			];

			const pages = await Promise.all(
				[
					0,
					1,
					2,
				].map((pageIndex) =>
					search(member, {
						sort: "name",
						pageSize: 2,
						pageIndex,
					}),
				),
			);
			expect(pages.map((page) => page.rowCount)).toEqual([
				5,
				5,
				5,
			]);
			expect(pages.flatMap((page) => page.data.map(entryName))).toEqual(byName);
			expect(
				pages.flatMap((page) => page.data.map((entry) => entry.kind)),
			).toEqual([
				"block",
				"bot",
				"bot",
				"asset",
				"block",
			]);

			const newest = await search(member, {});
			expect(newest.data.map(entryName)).toEqual([
				`C draft bot ${tag}`,
				`A behaviour ${tag}`,
				`E repository ${tag}`,
				`B bot ${tag}`,
				`D asset ${tag}`,
			]);

			// Drafts are blocks and bots the user edits; assets have no status.
			const drafts = await search(member, {
				status: "draft",
			});
			expect(drafts.data.map(entryName)).toEqual([
				`C draft bot ${tag}`,
			]);
			const mine = await search(member, {
				scope: "edit",
				sort: "name",
			});
			expect(mine.data.map(entryName)).toEqual([
				`C draft bot ${tag}`,
				`D asset ${tag}`,
				`E repository ${tag}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"search sends the same statements however many items a page holds",
		async () => {
			const fixture = await stocked();
			const { member, procedures, tag, bot, behaviour, titled } = fixture;
			await bot(member, `Bot 0 ${tag}`);
			await behaviour(member, `Behaviour 0 ${tag}`);
			await titled(member, `Asset 0 ${tag}`);

			const statementsFor = async () => {
				const counting = countingStatements(
					await procedureOptions(member, fixture.token()),
				);
				await run(
					procedures.library.search(
						{
							search: tag,
						},
						counting.options,
					),
				);
				return counting.statements();
			};
			const few = await statementsFor();
			for (const index of [
				1,
				2,
				3,
			]) {
				await bot(member, `Bot ${index} ${tag}`);
				await behaviour(member, `Behaviour ${index} ${tag}`);
				await titled(member, `Asset ${index} ${tag}`);
			}
			expect(await statementsFor()).toBe(few);
		},
		TIMEOUT,
	);

	test(
		"the overview shelves kinds, favourites and, for Mine, drafts",
		async () => {
			const {
				admin,
				member,
				procedures,
				call,
				tag,
				bot,
				behaviour,
				repository,
				titled,
				shown,
			} = await stocked();
			const favourite = await shown("bot", bot(admin, `Favourite ${tag}`));
			await bot(member, `Member draft ${tag}`, "draft");
			await shown("bot", bot(admin, `Admin draft ${tag}`, "draft"));
			await behaviour(member, `Member draft behaviour ${tag}`, "draft");
			await shown("block", behaviour(admin, `Admin behaviour ${tag}`));
			await repository(member, `Member repository ${tag}`);
			await titled(member, `Member asset ${tag}`);
			await titled(member, `Chat asset ${tag}`, "chat");
			await call(member, (options) =>
				procedures.bot.setFavourite(
					{
						id: favourite,
						favourite: true,
					},
					options,
				),
			);

			const overview = (scope: "all" | "edit") =>
				call(member, (options) =>
					procedures.library.overview(
						{
							scope,
						},
						options,
					),
				).then(({ data }) => data);

			const all = await overview("all");
			expect(all.favourites.map((row) => row.name)).toEqual([
				`Favourite ${tag}`,
			]);
			expect(all.drafts).toEqual([]);
			expect(all.bot.rowCount).toBe(2);
			expect(all.bot.data.map((row) => row.name)).toEqual([
				`Member draft ${tag}`,
				`Favourite ${tag}`,
			]);
			expect(all.behaviour.rowCount).toBe(2);
			expect(all.repository.rowCount).toBe(1);
			expect(all.asset.data.map((row) => row.title)).toEqual([
				`Member asset ${tag}`,
			]);

			const mine = await overview("edit");
			expect(mine.favourites).toEqual([]);
			expect(mine.drafts.map(entryName)).toEqual([
				`Member draft behaviour ${tag}`,
				`Member draft ${tag}`,
			]);
			expect(mine.bot.rowCount).toBe(1);
			expect(mine.behaviour.rowCount).toBe(1);
		},
		TIMEOUT,
	);
});
