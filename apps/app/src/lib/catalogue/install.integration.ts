import { describe, expect, test } from "bun:test";
import type { BlockId, BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { CatalogueEntryRef } from "@orcai/schema";
import { awaitLockWaiters } from "@orcai/testing";
import { and, count, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Client } from "pg";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason ?? "failed",
	);

/**
 * A listed, published bot with a behaviour and a repository holding one
 * asset, made in a home organisation; a second organisation with an
 * admin, a manager and a member; and a third organisation.
 */
const catalogue = async () => {
	const {
		organizationId: home,
		actors: [author],
		zedToken,
	} = await organizationWith([
		"admin",
	]);
	const {
		organizationId: other,
		actors: [admin, manager, member],
	} = await organizationWith([
		"admin",
		"manager",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const call = async <A>(
		actor: Actor,
		operation: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(operation(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const created = await createAsset(author, home);
	token = created.zedToken ?? token;
	const create = (type: "template" | "database") =>
		call(author, (options) =>
			procedures.block.create(
				type === "template"
					? {
							type,
							name: `Install behaviour ${crypto.randomUUID()}`,
							description: null,
							contentJson: null,
							status: "ready",
							config: {
								systemPrompt: "Answer from the handbook.",
							},
						}
					: {
							type,
							name: `Install repository ${crypto.randomUUID()}`,
							description: null,
							contentJson: null,
							status: "ready",
							assets: [
								created.asset.id,
							],
							config: {
								minReferences: 1,
								maxReferences: 5,
								defaultReferences: 3,
							},
						},
				options,
			),
		).then(({ data }) => data.id);
	const template = await create("template");
	const repository = await create("database");
	const { data: saved } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Install bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "ready",
				templateBlockId: template,
				databaseBlockIds: [
					repository,
				],
			},
			options,
		),
	);
	const bot = saved.id;
	await call(author, (options) =>
		procedures.resource.setVisibility(
			{
				resourceType: "bot",
				resourceId: bot,
				visibility: "public",
				listBlockIds: [
					template,
					repository,
				],
			},
			options,
		),
	);

	const entry = {
		bot: {
			resourceType: "bot",
			resourceId: bot,
		},
		repository: {
			resourceType: "block",
			resourceId: repository,
		},
	} satisfies Record<string, CatalogueEntryRef>;

	const install = (actor: Actor, ref: CatalogueEntryRef = entry.bot) =>
		call(actor, (options) =>
			procedures.catalogue.install(
				{
					entry: ref,
				},
				options,
			),
		).then(({ data }) => data.changed);
	const installWithBlocks = (actor: Actor) =>
		call(actor, (options) =>
			procedures.catalogue.install(
				{
					entry: entry.bot,
					withBlocks: true,
				},
				options,
			),
		).then(({ data }) => data);
	const installBlocks = (actor: Actor) =>
		call(actor, (options) =>
			procedures.catalogue.installBlocks(
				{
					botId: bot,
				},
				options,
			),
		).then(({ data }) => data.addedBlocks);
	const uninstall = (actor: Actor, ref: CatalogueEntryRef = entry.bot) =>
		call(actor, (options) =>
			procedures.catalogue.uninstall(
				{
					entry: ref,
				},
				options,
			),
		).then(({ data }) => data.changed);
	const grant = (
		actor: Actor,
		to: Actor,
		role: "viewer" | "editor" = "viewer",
		ref: CatalogueEntryRef = entry.bot,
	) =>
		call(actor, (options) =>
			procedures.resource.grant(
				{
					...ref,
					principals: [
						{
							principalType: "user",
							principalId: to.user.id,
						},
					],
					role,
				},
				options,
			),
		);

	return {
		home,
		other,
		author,
		admin,
		manager,
		member,
		procedures,
		call,
		bot,
		template,
		repository,
		asset: created.asset.id,
		entry,
		install,
		installWithBlocks,
		installBlocks,
		uninstall,
		grant,
	};
};

/** The organisations with an active install of the resource. */
const installs = (resourceId: BotId | BlockId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					organizationId: dbSchema.resourceScope.organizationId,
				})
				.from(dbSchema.resourceScope)
				.where(
					and(
						eq(dbSchema.resourceScope.resourceId, resourceId),
						eq(dbSchema.resourceScope.isPrimary, false),
						isNull(dbSchema.resourceScope.endedAt),
					),
				);
			return rows.map((row) => row.organizationId);
		}),
	);

describe("installing from the catalogue", () => {
	test(
		"admins and managers add a listed entry once; members and the home cannot",
		async () => {
			const s = await catalogue();
			expect(await reasonOf(s.install(s.member))).toBe("PERMISSION_DENIED");
			expect(await s.install(s.admin)).toBe(true);
			expect(await s.install(s.manager)).toBe(false);
			expect(await installs(s.bot)).toEqual([
				s.other,
			]);
			expect(await reasonOf(s.install(s.author))).toBe(
				"RESOURCE_HOME_ORGANIZATION",
			);
			expect(await reasonOf(s.uninstall(s.author))).toBe(
				"RESOURCE_HOME_ORGANIZATION",
			);

			expect(await s.uninstall(s.manager)).toBe(true);
			expect(await s.uninstall(s.admin)).toBe(false);
			expect(await installs(s.bot)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"an unlisted resource cannot be added",
		async () => {
			const s = await catalogue();
			await s.call(s.author, (options) =>
				s.procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: s.bot,
						visibility: "private",
						listBlockIds: [],
					},
					options,
				),
			);
			expect(await reasonOf(s.install(s.admin))).toBe("RESOURCE_NOT_LISTED");
			expect(
				await reasonOf(
					s.call(s.admin, (options) =>
						s.procedures.catalogue.find(
							{
								entry: s.entry.bot,
							},
							options,
						),
					),
				),
			).toBe("BOT_NOT_FOUND");
		},
		TIMEOUT,
	);

	test(
		"an install racing an unlist never outlives the listing",
		async () => {
			for (const installFirst of [
				true,
				false,
			]) {
				const s = await catalogue();
				const install = () => reasonOf(s.install(s.admin));
				const unlist = () =>
					reasonOf(
						s.call(s.author, (options) =>
							s.procedures.resource.setVisibility(
								{
									resourceType: "bot",
									resourceId: s.bot,
									visibility: "private",
									listBlockIds: [],
								},
								options,
							),
						),
					);
				const reasons: (string | undefined)[] = [];
				await queueBehindOrganizationLock(
					s.home,
					async () => {
						reasons[0] = await (installFirst ? install() : unlist());
					},
					async () => {
						reasons[1] = await (installFirst ? unlist() : install());
					},
				);
				expect(reasons).toEqual(
					installFirst
						? [
								undefined,
								undefined,
							]
						: [
								undefined,
								"RESOURCE_NOT_LISTED",
							],
				);
				expect(await installs(s.bot)).toEqual([]);
			}
		},
		TIMEOUT,
	);
});

describe("adding a bot with its blocks", () => {
	test(
		"admins and managers add the bot's blocks once, each on its own; members cannot",
		async () => {
			const s = await catalogue();
			expect(await reasonOf(s.installWithBlocks(s.member))).toBe(
				"PERMISSION_DENIED",
			);
			for (const id of [
				s.bot,
				s.template,
				s.repository,
			])
				expect(await installs(id)).toEqual([]);

			expect(await s.installWithBlocks(s.admin)).toEqual({
				changed: true,
				addedBlocks: 2,
			});
			expect(await s.installWithBlocks(s.manager)).toEqual({
				changed: false,
				addedBlocks: 0,
			});
			expect(await s.uninstall(s.admin)).toBe(true);
			expect(await installs(s.bot)).toEqual([]);
			expect(await installs(s.template)).toEqual([
				s.other,
			]);
			expect(await installs(s.repository)).toEqual([
				s.other,
			]);
		},
		TIMEOUT,
	);

	test(
		"blocks added already are skipped",
		async () => {
			const s = await catalogue();
			expect(await s.install(s.admin, s.entry.repository)).toBe(true);
			expect(await s.install(s.admin)).toBe(true);
			expect(await s.installWithBlocks(s.admin)).toEqual({
				changed: false,
				addedBlocks: 1,
			});
			expect(await installs(s.template)).toEqual([
				s.other,
			]);
			expect(await installs(s.repository)).toEqual([
				s.other,
			]);
		},
		TIMEOUT,
	);

	test(
		"blocks the organisation is home to are skipped",
		async () => {
			const s = await catalogue();
			const { data: own } = await s.call(s.admin, (options) =>
				s.procedures.block.create(
					{
						type: "database",
						name: `Install own repository ${crypto.randomUUID()}`,
						description: null,
						contentJson: null,
						status: "ready",
						assets: [],
						config: {
							minReferences: 1,
							maxReferences: 5,
							defaultReferences: 3,
						},
					},
					options,
				),
			);
			const ownRef = {
				resourceType: "block",
				resourceId: own.id,
			} satisfies CatalogueEntryRef;
			await s.call(s.admin, (options) =>
				s.procedures.resource.setVisibility(
					{
						...ownRef,
						visibility: "public",
						listBlockIds: [],
					},
					options,
				),
			);
			expect(await s.install(s.author, ownRef)).toBe(true);
			await s.grant(s.author, s.author, "viewer", ownRef);
			await s.call(s.author, (options) =>
				s.procedures.bot.save(
					{
						id: s.bot,
						name: `Install bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "ready",
						templateBlockId: s.template,
						databaseBlockIds: [
							s.repository,
							own.id,
						],
					},
					options,
				),
			);

			expect(await s.installWithBlocks(s.admin)).toEqual({
				changed: true,
				addedBlocks: 2,
			});
			expect(await installs(own.id)).toEqual([
				s.home,
			]);
			expect(await installs(s.repository)).toEqual([
				s.other,
			]);
		},
		TIMEOUT,
	);

	test(
		"a block taken out of the bot and unlisted meanwhile never stays added",
		async () => {
			for (const installFirst of [
				true,
				false,
			]) {
				const s = await catalogue();
				const install = () => s.installWithBlocks(s.admin);
				const removeAndUnlist = async () => {
					await s.call(s.author, (options) =>
						s.procedures.bot.save(
							{
								id: s.bot,
								name: `Install bot ${crypto.randomUUID()}`,
								description: "Integration bot",
								status: "ready",
								templateBlockId: s.template,
								databaseBlockIds: [],
							},
							options,
						),
					);
					await s.call(s.author, (options) =>
						s.procedures.resource.setVisibility(
							{
								...s.entry.repository,
								visibility: "private",
								listBlockIds: [],
							},
							options,
						),
					);
				};
				let added: number | undefined;
				await queueBehindOrganizationLock(
					s.home,
					async () => {
						if (installFirst) added = (await install()).addedBlocks;
						else await removeAndUnlist();
					},
					async () => {
						if (installFirst) await removeAndUnlist();
						else added = (await install()).addedBlocks;
					},
				);
				expect(added).toBe(installFirst ? 2 : 1);
				expect(await installs(s.repository)).toEqual([]);
				expect(await installs(s.template)).toEqual([
					s.other,
				]);
			}
		},
		TIMEOUT,
	);
});

describe("adding the blocks of an added bot", () => {
	test(
		"needs the bot added, and never adds it",
		async () => {
			const s = await catalogue();
			expect(await reasonOf(s.installBlocks(s.admin))).toBe(
				"RESOURCE_NOT_INSTALLED",
			);
			expect(await s.install(s.admin)).toBe(true);
			expect(await reasonOf(s.installBlocks(s.member))).toBe(
				"PERMISSION_DENIED",
			);
			expect(await s.installBlocks(s.manager)).toBe(2);
			expect(await s.installBlocks(s.admin)).toBe(0);
			for (const id of [
				s.bot,
				s.template,
				s.repository,
			])
				expect(await installs(id)).toEqual([
					s.other,
				]);
		},
		TIMEOUT,
	);

	test(
		"a removal committed first is not undone",
		async () => {
			for (const removeFirst of [
				true,
				false,
			]) {
				const s = await catalogue();
				expect(await s.install(s.admin)).toBe(true);
				const remove = () => reasonOf(s.uninstall(s.manager));
				const addBlocks = () => reasonOf(s.installBlocks(s.admin));
				const reasons: (string | undefined)[] = [];
				// Both lock both organisations, the first in sort order first.
				const [first] = [
					s.home,
					s.other,
				].sort();
				await queueBehindOrganizationLock(
					first as OrganizationId,
					async () => {
						reasons[0] = await (removeFirst ? remove() : addBlocks());
					},
					async () => {
						reasons[1] = await (removeFirst ? addBlocks() : remove());
					},
				);
				expect(reasons).toEqual(
					removeFirst
						? [
								undefined,
								"RESOURCE_NOT_INSTALLED",
							]
						: [
								undefined,
								undefined,
							],
				);
				expect(await installs(s.bot)).toEqual([]);
				expect(await installs(s.repository)).toEqual(
					removeFirst
						? []
						: [
								s.other,
							],
				);
			}
		},
		TIMEOUT,
	);
});

describe("sharing an installed resource", () => {
	test(
		"installers share it in their organisation for use only, to its own principals",
		async () => {
			const s = await catalogue();
			expect(await reasonOf(s.grant(s.admin, s.member))).toBe(
				"RESOURCE_SCOPE_REQUIRED",
			);
			await s.install(s.admin);

			expect(await reasonOf(s.grant(s.member, s.member))).toBe(
				"PERMISSION_DENIED",
			);
			expect(await reasonOf(s.grant(s.manager, s.member, "editor"))).toBe(
				"INSTALL_GRANTS_VIEWER_ONLY",
			);
			expect(await reasonOf(s.grant(s.manager, s.author))).toBe(
				"GRANT_PRINCIPALS_INVALID",
			);
			await s.grant(s.manager, s.member);

			const { data: grants } = await s.call(s.admin, (options) =>
				s.procedures.resource.listGrants(s.entry.bot, options),
			);
			expect(grants.map((grant) => grant.principalId)).toEqual([
				s.member.user.id,
			]);
			const { data: principals } = await s.call(s.admin, (options) =>
				s.procedures.resource.listPrincipals(
					{
						...s.entry.bot,
						principalType: "user",
						limit: 50,
					},
					options,
				),
			);
			expect(principals.map((principal) => principal.id).sort()).toEqual(
				[
					s.admin.user.id,
					s.manager.user.id,
					s.member.user.id,
				].sort(),
			);
		},
		TIMEOUT,
	);

	test(
		"installers edit the bot's setup there, not its definition",
		async () => {
			const s = await catalogue();
			await s.install(s.admin);
			const setupOf = (actor: Actor) =>
				s
					.call(actor, (options) =>
						s.procedures.botSetup.find(
							{
								botId: s.bot,
							},
							options,
						),
					)
					.then(({ data }) => data.canEdit);
			expect(await setupOf(s.manager)).toBe(true);
			expect(await setupOf(s.member)).toBe(false);
			expect(
				await reasonOf(
					s.call(s.admin, (options) =>
						s.procedures.bot.save(
							{
								id: s.bot,
								name: "Renamed",
								description: "Integration bot",
								status: "ready",
								templateBlockId: s.template,
								databaseBlockIds: [
									s.repository,
								],
							},
							options,
						),
					),
				),
			).toBe("PERMISSION_DENIED");
		},
		TIMEOUT,
	);
});

describe("an organisation's chats with an installed bot", () => {
	test(
		"turn read-only on uninstall and writable again after a reinstall and share",
		async () => {
			const s = await catalogue();
			await s.install(s.admin);
			await s.grant(s.admin, s.member);
			const { data: chat } = await s.call(s.member, (options) =>
				s.procedures.chat.create(
					{
						title: "Installed bot chat",
						botId: s.bot,
					},
					options,
				),
			);
			const readOnly = () =>
				s
					.call(s.member, (options) =>
						s.procedures.chat.find(
							{
								id: chat.id,
							},
							options,
						),
					)
					.then(({ data }) => data.readOnly);
			expect(await readOnly()).toBeNull();

			await s.uninstall(s.admin);
			expect(await readOnly()).toBe("bot-unavailable");

			await s.install(s.admin);
			expect(await readOnly()).toBe("bot-unavailable");
			await s.grant(s.admin, s.member);
			expect(await readOnly()).toBeNull();
		},
		TIMEOUT,
	);
});

describe("the library with installs", () => {
	test(
		"lists an installed repository from its home and loads its assets through it",
		async () => {
			const s = await catalogue();
			const repositories = (origin: "all" | "own" | "added") =>
				s
					.call(s.member, (options) =>
						s.procedures.block.list(
							{
								pageIndex: 0,
								pageSize: 50,
								filters: {
									type: "database",
									origin,
								},
							},
							options,
						),
					)
					.then(({ data }) =>
						data.map((block) => ({
							id: block.id,
							from: block.installedFrom?.id ?? null,
						})),
					);
			expect(await repositories("all")).toEqual([]);

			await s.install(s.admin, s.entry.repository);
			await s.grant(s.admin, s.member, "viewer", s.entry.repository);
			const listed = [
				{
					id: s.repository,
					from: s.home,
				},
			];
			expect(await repositories("all")).toEqual(listed);
			expect(await repositories("added")).toEqual(listed);
			expect(await repositories("own")).toEqual([]);

			const { data: assets } = await s.call(s.member, (options) =>
				s.procedures.asset.list(
					{
						pageIndex: 0,
						pageSize: 50,
						filters: {
							repositoryId: s.repository,
						},
					},
					options,
				),
			);
			expect(assets.map((asset) => asset.id)).toEqual([
				s.asset,
			]);
			const { data: libraryAssets } = await s.call(s.member, (options) =>
				s.procedures.asset.list(
					{
						pageIndex: 0,
						pageSize: 50,
					},
					options,
				),
			);
			expect(libraryAssets).toEqual([]);

			await s.uninstall(s.admin, s.entry.repository);
			expect(await repositories("all")).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"chat pickers offer an installed bot only to those it is shared with",
		async () => {
			const s = await catalogue();
			await s.install(s.admin);
			const bots = (usable: boolean) =>
				s
					.call(s.member, (options) =>
						s.procedures.bot.list(
							{
								pageIndex: 0,
								pageSize: 50,
								filters: {
									usable,
								},
							},
							options,
						),
					)
					.then(({ data }) => data.map((bot) => bot.id));
			expect(await bots(false)).toEqual([
				s.bot,
			]);
			expect(await bots(true)).toEqual([]);
			await s.grant(s.admin, s.member);
			expect(await bots(true)).toEqual([
				s.bot,
			]);
		},
		TIMEOUT,
	);
});

describe("the catalogue", () => {
	test(
		"lists the entry for every organisation, marked by how it relates to it",
		async () => {
			const s = await catalogue();
			const states = (actor: Actor, hideAdded = false) =>
				s
					.call(actor, (options) =>
						s.procedures.catalogue.list(
							{
								pageIndex: 0,
								pageSize: 50,
								organizationIds: [
									s.home,
								],
								hideAdded,
							},
							options,
						),
					)
					.then(({ data }) =>
						data.map((entry) => `${entry.kind}:${entry.state}`).sort(),
					);
			const everything = [
				"behaviour:available",
				"bot:available",
				"repository:available",
			];
			expect(await states(s.member)).toEqual(everything);
			expect(await states(s.author)).toEqual([
				"behaviour:home",
				"bot:home",
				"repository:home",
			]);

			await s.install(s.admin);
			expect(await states(s.member)).toEqual([
				"behaviour:available",
				"bot:added",
				"repository:available",
			]);
			expect(await states(s.member, true)).toEqual([
				"behaviour:available",
				"repository:available",
			]);

			const { data: detail } = await s.call(s.member, (options) =>
				s.procedures.catalogue.find(
					{
						entry: s.entry.bot,
					},
					options,
				),
			);
			expect(detail.source.id).toBe(s.home);
			expect(detail.contents).toEqual({
				behaviour: true,
				repositories: 1,
			});
			expect(detail.blocks.map((block) => block.id).sort()).toEqual(
				[
					s.template,
					s.repository,
				].sort(),
			);

			const { data: counted } = await s.call(s.member, (options) =>
				s.procedures.catalogue.counts({}, options),
			);
			expect(
				counted.organizations.find((organization) => organization.id === s.home)
					?.entries,
			).toBe(3);
		},
		TIMEOUT,
	);
});

const postgres = () =>
	new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});

/** Sets a member's role in Postgres only, as a demotion whose tuples have not arrived. */
const demoteInPostgres = (actor: Actor, organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.member)
				.set({
					role: "member",
				})
				.where(
					and(
						eq(dbSchema.member.organizationId, organizationId),
						eq(dbSchema.member.userId, actor.user.id),
					),
				);
		}),
	);

describe("installers demoted", () => {
	test(
		"lose installing, sharing and setup before their tuples follow",
		async () => {
			const s = await catalogue();
			await s.install(s.admin);
			await demoteInPostgres(s.manager, s.other);

			expect(await reasonOf(s.install(s.manager, s.entry.repository))).toBe(
				"PERMISSION_DENIED",
			);
			expect(await reasonOf(s.uninstall(s.manager))).toBe("PERMISSION_DENIED");
			expect(await reasonOf(s.grant(s.manager, s.member))).toBe(
				"PERMISSION_DENIED",
			);
			const { data: setup } = await s.call(s.manager, (options) =>
				s.procedures.botSetup.find(
					{
						botId: s.bot,
					},
					options,
				),
			);
			expect(setup.canEdit).toBe(false);
			expect(await installs(s.bot)).toEqual([
				s.other,
			]);
		},
		TIMEOUT,
	);

	test(
		"by a role change queued first cannot install",
		async () => {
			const s = await catalogue();
			let reason: string | undefined = "not run";
			await queueBehindOrganizationLock(
				s.other,
				() =>
					s.call(s.admin, (options) =>
						s.procedures.organizationMember.update(
							{
								userId: s.manager.user.id,
								role: "member",
							},
							options,
						),
					),
				async () => {
					reason = await reasonOf(s.install(s.manager));
				},
			);
			expect(reason).toBe("PERMISSION_DENIED");
			expect(await installs(s.bot)).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("an installed bot's setup", () => {
	test(
		"never outlives the install a save races",
		async () => {
			for (const saveFirst of [
				true,
				false,
			]) {
				const s = await catalogue();
				await s.install(s.admin);
				const { data: provider } = await s.call(s.admin, (options) =>
					s.procedures.provider.create(
						{
							name: `Install ${crypto.randomUUID()}`,
							description: "Serves the install test.",
							kind: "openai-compatible",
							endpoint: "http://127.0.0.1:9/v1",
							apiKey: "key",
							meteringMode: "tokens",
							enabled: true,
						},
						options,
					),
				);
				const { data: model } = await s.call(s.admin, (options) =>
					s.procedures.model.create(
						{
							providerId: provider.id,
							providerModelId: `install-${crypto.randomUUID()}`,
							name: "Install model",
							description: "A chat model.",
							isDeprecated: false,
							capabilities: [
								"text",
								"tool-calling",
							],
							maxOutputTokens: null,
						},
						options,
					),
				);
				const save = () =>
					reasonOf(
						s.call(s.manager, (options) =>
							s.procedures.botSetup.save(
								{
									botId: s.bot,
									setup: {
										modelId: model.id,
										strength: "recommended",
										generation: {},
									},
								},
								options,
							),
						),
					);
				const uninstall = () => reasonOf(s.uninstall(s.admin));
				const reasons: (string | undefined)[] = [];
				// Both lock the bot's home and this organisation, in id order.
				const [firstLocked] = [
					s.home,
					s.other,
				].sort();
				await queueBehindOrganizationLock(
					firstLocked,
					async () => {
						reasons[0] = await (saveFirst ? save() : uninstall());
					},
					async () => {
						reasons[1] = await (saveFirst ? uninstall() : save());
					},
				);
				expect(reasons).toEqual(
					saveFirst
						? [
								undefined,
								undefined,
							]
						: [
								undefined,
								"BOT_SETUP_FORBIDDEN",
							],
				);
				const [setups] = await run(
					Effect.gen(function* () {
						return yield* (yield* DB)
							.select({
								count: count(),
							})
							.from(dbSchema.botSetup)
							.where(
								and(
									eq(dbSchema.botSetup.botId, s.bot),
									eq(dbSchema.botSetup.organizationId, s.other),
								),
							);
					}),
				);
				expect(setups.count).toBe(0);
			}
		},
		TIMEOUT,
	);
});

/**
 * Runs `read` until it waits on a lock of `table`, runs `meanwhile`, then lets
 * `read` finish.
 */
const pausedOn = async <A>(
	table: string,
	read: () => Promise<A>,
	meanwhile: () => Promise<unknown>,
) => {
	const client = postgres();
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query(`LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`);
		const reading = read();
		await run(awaitLockWaiters(`%"${table}"%`));
		await meanwhile();
		await client.query("COMMIT");
		return await reading;
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
		await client.end();
	}
};

/** Unlists the behaviour and saves an unpublished draft of it, in Postgres. */
const unlistAndDraft = (template: BlockId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db
				.update(dbSchema.resourceVisibility)
				.set({
					visibility: "private",
				})
				.where(
					and(
						eq(dbSchema.resourceVisibility.resourceType, "block"),
						eq(dbSchema.resourceVisibility.resourceId, template),
					),
				);
			yield* db
				.update(dbSchema.block)
				.set({
					description: "Unpublished description.",
					config: {
						systemPrompt: "Unpublished draft.",
					},
				})
				.where(eq(dbSchema.block.id, template));
		}),
	);

describe("an entry's page", () => {
	test(
		"reads one snapshot, so content saved after an unlisting never shows",
		async () => {
			const s = await catalogue();
			// The page's first query runs; a later one waits on the lock.
			const { data } = await pausedOn(
				"block_asset",
				() =>
					s.call(s.member, (options) =>
						s.procedures.catalogue.find(
							{
								entry: {
									resourceType: "block",
									resourceId: s.template,
								},
							},
							options,
						),
					),
				() => unlistAndDraft(s.template),
			);
			expect(data.prompt).toBe("Answer from the handbook.");
			expect(data.description).toBeNull();
		},
		TIMEOUT,
	);
});

describe("a catalogue page", () => {
	test(
		"reads one snapshot, so metadata saved after an unlisting never shows",
		async () => {
			const s = await catalogue();
			// The page's entries are selected; reading their tiles waits on the lock.
			const { data } = await pausedOn(
				"user",
				() =>
					s.call(s.member, (options) =>
						s.procedures.catalogue.list(
							{
								pageIndex: 0,
								pageSize: 50,
								kind: "behaviour",
								organizationIds: [
									s.home,
								],
							},
							options,
						),
					),
				() => unlistAndDraft(s.template),
			);
			expect(data.map((entry) => entry.id)).toEqual([
				s.template,
			]);
			expect(data[0].description).toBeNull();
		},
		TIMEOUT,
	);
});
