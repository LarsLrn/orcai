import { describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { AssetId, BotId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { LibraryEntry } from "@orcai/schema";
import { SpiceDbService } from "@orcai/spice-db";
import { and, eq } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { libraryIntegration } from "@/lib/library/library-integration";
import { type Actor, TIMEOUT } from "@/lib/testing/app-integration";

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

/** Ends the reader's grant on the bot in Postgres only, as before its tuple is removed. */
const revokeInPostgresOnly = (botId: BotId, reader: Actor) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.resourceGrant)
				.set({
					revokedAt: new Date(),
				})
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceId, botId),
						eq(dbSchema.resourceGrant.principalId, reader.user.id),
					),
				);
		}),
	);

/** Removes the reader's viewer tuple on the bot from SpiceDB only; the zed token after it. */
const removeViewerTupleOnly = (botId: BotId, reader: Actor) =>
	run(
		Effect.gen(function* () {
			const { spice } = yield* SpiceDbService;
			const { deletedAt } = yield* Effect.promise(() =>
				spice.deleteRelationships(
					v1.DeleteRelationshipsRequest.create({
						relationshipFilter: v1.RelationshipFilter.create({
							resourceType: "bot",
							optionalResourceId: botId,
							optionalRelation: "viewer",
							optionalSubjectFilter: v1.SubjectFilter.create({
								subjectType: "user",
								optionalSubjectId: reader.user.id,
							}),
						}),
					}),
				),
			);
			return deletedAt?.token;
		}),
	);

/**
 * `options` under which the first SpiceDB bulk check of `permission` on
 * `resourceId` waits until `during` has run, as if a write landed while
 * SpiceDB answered.
 */
const pausingCheck = async <
	O extends Awaited<ReturnType<typeof procedureOptions>>,
>(
	options: O,
	resourceId: string,
	permission: "read" | "use",
	during: () => Promise<unknown>,
): Promise<O> => {
	const { spice } = await run(SpiceDbService);
	let pending = true;
	const checkBulkPermissions: typeof spice.checkBulkPermissions = async (
		request,
		...rest
	) => {
		if (
			pending &&
			request.items.some(
				(item) =>
					item.resource?.objectId === resourceId &&
					item.permission === permission,
			)
		) {
			pending = false;
			await during();
		}
		return spice.checkBulkPermissions(request, ...rest);
	};
	return {
		...options,
		context: {
			...options.context,
			"effect/context": Context.add(
				options.context["effect/context"],
				SpiceDbService,
				{
					spice: new Proxy(spice, {
						get: (target, key) =>
							key === "checkBulkPermissions"
								? checkBulkPermissions
								: Reflect.get(target, key),
					}),
				},
			),
		},
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
				bot: {
					total: 2,
					drafts: 1,
				},
				behaviour: {
					total: 1,
					drafts: 0,
				},
				repository: {
					total: 1,
					drafts: 0,
				},
				asset: {
					total: 1,
					drafts: 0,
				},
			});
			expect(
				await counts(member, {
					scope: "edit",
				}),
			).toEqual({
				bot: {
					total: 1,
					drafts: 1,
				},
				behaviour: {
					total: 0,
					drafts: 0,
				},
				repository: {
					total: 1,
					drafts: 0,
				},
				asset: {
					total: 1,
					drafts: 0,
				},
			});
			expect(
				await counts(member, {
					search: "alpha",
				}),
			).toEqual({
				bot: {
					total: 1,
					drafts: 0,
				},
				behaviour: {
					total: 1,
					drafts: 0,
				},
				repository: {
					total: 0,
					drafts: 0,
				},
				asset: {
					total: 1,
					drafts: 0,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"counts match each kind's list for owned, added and shared items and leave out chat uploads",
		async () => {
			const elsewhere = await organization();
			const listedBehaviour = await elsewhere.behaviour(
				elsewhere.admin,
				`Listed behaviour ${crypto.randomUUID()}`,
			);
			const listedBot = (
				await elsewhere.call(elsewhere.admin, (options) =>
					elsewhere.procedures.bot.save(
						{
							name: `Listed bot ${crypto.randomUUID()}`,
							description: "Integration bot",
							status: "ready",
							behaviourId: listedBehaviour,
						},
						options,
					),
				)
			).data.id;
			await elsewhere.call(elsewhere.admin, (options) =>
				elsewhere.procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: listedBot,
						visibility: "public",
						listBlockIds: [
							listedBehaviour,
						],
					},
					options,
				),
			);

			const {
				admin,
				member,
				procedures,
				call,
				observe,
				tag,
				bot,
				behaviour,
				repository,
				titled,
				shown,
			} = await stocked();
			observe(elsewhere.token());
			await call(admin, (options) =>
				procedures.catalogue.add(
					{
						entry: {
							resourceType: "bot",
							resourceId: listedBot,
						},
						withBlocks: true,
					},
					options,
				),
			);
			await bot(member, `Own bot ${tag}`);
			await bot(member, `Own draft bot ${tag}`, "draft");
			await shown("bot", bot(admin, `Shared bot ${tag}`));
			await bot(admin, `Unshared bot ${tag}`);
			await behaviour(member, `Own draft behaviour ${tag}`, "draft");
			await shown("block", behaviour(admin, `Shared behaviour ${tag}`));
			await repository(member, `Own repository ${tag}`);
			await titled(member, `Library asset ${tag}`);
			await titled(member, `Chat asset ${tag}`, "chat");

			const rows = (
				read: Promise<{
					rowCount: number;
				}>,
			) => read.then(({ rowCount }) => rowCount);
			const listed = (status: "ready" | "draft") =>
				Promise.all([
					rows(
						call(member, (options) =>
							procedures.bot.list(
								{
									filters: {
										status,
									},
								},
								options,
							),
						),
					),
					...(
						[
							"behaviour",
							"repository",
						] as const
					).map((type) =>
						rows(
							call(member, (options) =>
								procedures.block.list(
									{
										filters: {
											type,
											status,
										},
									},
									options,
								),
							),
						),
					),
				]);
			const [[bots, behaviours, repositories], [botDrafts, behaviourDrafts]] =
				await Promise.all([
					listed("ready"),
					listed("draft"),
				]);
			const assets = await rows(
				call(member, (options) =>
					procedures.asset.list(
						{
							filters: {
								keptIn: "library",
							},
						},
						options,
					),
				),
			);
			const { data: counts } = await call(member, (options) =>
				procedures.library.counts({}, options),
			);

			// Published: own, shared and added bots; the shared and the added behaviour.
			expect({
				bots,
				botDrafts,
				behaviours,
				behaviourDrafts,
				repositories,
				assets,
			}).toEqual({
				bots: 3,
				botDrafts: 1,
				behaviours: 2,
				behaviourDrafts: 1,
				repositories: 1,
				assets: 1,
			});
			expect(counts).toEqual({
				bot: {
					total: bots + botDrafts,
					drafts: botDrafts,
				},
				behaviour: {
					total: behaviours + behaviourDrafts,
					drafts: behaviourDrafts,
				},
				repository: {
					total: repositories,
					drafts: 0,
				},
				asset: {
					total: assets,
					drafts: 0,
				},
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
	test(
		"lists and counts hold only this library's items the reader may read in both stores",
		async () => {
			const elsewhere = await organization();
			const listedElsewhere = (
				await elsewhere.call(elsewhere.admin, (options) =>
					elsewhere.procedures.bot.save(
						{
							name: `Elsewhere bot ${crypto.randomUUID()}`,
							description: "Integration bot",
							status: "ready",
						},
						options,
					),
				)
			).data.id;
			await elsewhere.call(elsewhere.admin, (options) =>
				elsewhere.procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: listedElsewhere,
						visibility: "public",
						listBlockIds: [],
					},
					options,
				),
			);

			const { admin, member, procedures, call, observe, tag, bot, shown } =
				await stocked();
			observe(elsewhere.token());
			await bot(member, `A own ${tag}`);
			await shown("bot", bot(admin, `B shared ${tag}`));
			const revoked = await shown("bot", bot(admin, `C revoked ${tag}`));
			const undelivered = await shown(
				"bot",
				bot(admin, `D undelivered ${tag}`),
			);

			const listed = async () => {
				const [search, counts, usable] = await Promise.all([
					call(member, (options) =>
						procedures.library.search(
							{
								search: tag,
							},
							options,
						),
					),
					call(member, (options) =>
						procedures.library.counts(
							{
								search: tag,
							},
							options,
						),
					),
					call(member, (options) =>
						procedures.bot.list(
							{
								search: tag,
								filters: {
									usable: true,
								},
							},
							options,
						),
					),
				]);
				return {
					search: search.data.map(entryName).sort(),
					rowCount: search.rowCount,
					bots: counts.data.bot.total,
					usable: usable.data.map((row) => row.name).sort(),
				};
			};
			const all = [
				`A own ${tag}`,
				`B shared ${tag}`,
				`C revoked ${tag}`,
				`D undelivered ${tag}`,
			];
			expect(await listed()).toEqual({
				search: all,
				rowCount: 4,
				bots: 4,
				usable: all,
			});

			// The other organisation's listed bot is readable, just not in this library.
			expect(
				(
					await call(member, (options) =>
						procedures.bot.find(
							{
								id: listedElsewhere,
							},
							options,
						),
					)
				).data.id,
			).toBe(listedElsewhere);

			await revokeInPostgresOnly(revoked, member);
			observe(await removeViewerTupleOnly(undelivered, member));

			const kept = [
				`A own ${tag}`,
				`B shared ${tag}`,
			];
			expect(await listed()).toEqual({
				search: kept,
				rowCount: 2,
				bots: 2,
				usable: kept,
			});
		},
		TIMEOUT,
	);
	test(
		"a grant revoked while SpiceDB answers is gone from the same list",
		async () => {
			const fixture = await stocked();
			const { admin, member, procedures, call, tag, bot, shown } = fixture;
			const shared = await shown("bot", bot(admin, `Shared ${tag}`));
			const listed = await shown("bot", bot(admin, `Listed ${tag}`));
			await call(admin, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: listed,
						visibility: "public",
						listBlockIds: [],
					},
					options,
				),
			);

			const names = (page: {
				data: {
					name: string;
				}[];
				rowCount: number;
			}) => ({
				names: page.data.map((row) => row.name),
				rowCount: page.rowCount,
			});

			// Read: the shared bot passes SpiceDB, then its only grant ends.
			const readable = await run(
				procedures.bot.list(
					{
						search: tag,
						sort: "name",
					},
					await pausingCheck(
						await procedureOptions(member, fixture.token()),
						shared,
						"read",
						() => revokeInPostgresOnly(shared, member),
					),
				),
			);
			expect(names(readable)).toEqual({
				names: [
					`Listed ${tag}`,
				],
				rowCount: 1,
			});

			// Use: the listed bot stays readable, but its grant was what let the member use it.
			const usable = await run(
				procedures.bot.list(
					{
						search: tag,
						filters: {
							usable: true,
						},
					},
					await pausingCheck(
						await procedureOptions(member, fixture.token()),
						listed,
						"use",
						() => revokeInPostgresOnly(listed, member),
					),
				),
			);
			expect(names(usable)).toEqual({
				names: [],
				rowCount: 0,
			});
		},
		TIMEOUT,
	);
});
