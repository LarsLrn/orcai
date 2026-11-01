import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { defaultRepositoryConfig, type PipelineStatus } from "@orcai/schema";
import { createOrganization } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { type Actor, TIMEOUT } from "@/lib/authz/authz-integration";
import { libraryIntegration } from "@/lib/library/library-integration";

const {
	run,
	procedureOptions,
	signIn,
	organization,
	countingStatements,
	names,
} = libraryIntegration();

describe("library lists", () => {
	test(
		"Mine lists what the user can edit: owned, managed, user and group editor",
		async () => {
			const { admin, member, procedures, call, behaviour, share, toMember } =
				await organization();
			const tag = crypto.randomUUID();
			await behaviour(member, `Own ${tag}`);
			const managed = await behaviour(admin, `Managed ${tag}`);
			const edited = await behaviour(admin, `Edited ${tag}`);
			const groupEdited = await behaviour(admin, `Group edited ${tag}`);
			const viewed = await behaviour(admin, `Viewed ${tag}`);
			const listed = await behaviour(admin, `Listed ${tag}`);
			const block = (resourceId: BlockId) => ({
				resourceType: "block" as const,
				resourceId,
			});

			const { data: team } = await call(admin, (options) =>
				procedures.group.create(
					{
						name: `Editors ${tag}`,
					},
					options,
				),
			);
			await call(admin, (options) =>
				procedures.group.addMembers(
					{
						groupId: team.id,
						userIds: [
							member.user.id,
						],
					},
					options,
				),
			);
			await share(block(managed), "manager", toMember);
			await share(block(edited), "editor", toMember);
			await share(block(groupEdited), "editor", {
				principalType: "group",
				principalId: team.id,
			});
			await share(block(viewed), "viewer", toMember);
			await call(admin, (options) =>
				procedures.resource.setVisibility(
					{
						...block(listed),
						visibility: "public",
					},
					options,
				),
			);

			const list = (scope: "all" | "edit") =>
				call(member, (options) =>
					procedures.block.list(
						{
							filters: {
								type: "behaviour",
								search: tag,
								scope,
							},
						},
						options,
					),
				);

			expect(names(await list("edit"))).toEqual(
				[
					`Own ${tag}`,
					`Managed ${tag}`,
					`Edited ${tag}`,
					`Group edited ${tag}`,
				].sort(),
			);
			expect(names(await list("all"))).toEqual(
				[
					`Own ${tag}`,
					`Managed ${tag}`,
					`Edited ${tag}`,
					`Group edited ${tag}`,
					`Viewed ${tag}`,
					`Listed ${tag}`,
				].sort(),
			);
		},
		TIMEOUT,
	);

	test(
		"both statuses page published blocks the user reads and drafts they edit",
		async () => {
			const { admin, member, procedures, call, behaviour, share, toMember } =
				await organization();
			const tag = crypto.randomUUID();
			const block = (resourceId: BlockId) => ({
				resourceType: "block" as const,
				resourceId,
			});
			await behaviour(member, `A own ${tag}`);
			await behaviour(member, `B own draft ${tag}`, "draft");
			await share(
				block(await behaviour(admin, `C shared ${tag}`)),
				"viewer",
				toMember,
			);
			await share(
				block(await behaviour(admin, `D shared draft ${tag}`, "draft")),
				"viewer",
				toMember,
			);
			await share(
				block(await behaviour(admin, `E edited draft ${tag}`, "draft")),
				"editor",
				toMember,
			);
			// Equal names order by id.
			const twins = [
				await behaviour(member, `F twin ${tag}`),
				await behaviour(member, `F twin ${tag}`),
			].sort();

			const page = (status: "ready" | "draft" | "all", pageIndex: number) =>
				call(member, (options) =>
					procedures.block.list(
						{
							pageIndex,
							pageSize: 2,
							sort: "name",
							filters: {
								type: "behaviour",
								search: tag,
								status,
							},
						},
						options,
					),
				);

			const pages = await Promise.all(
				[
					0,
					1,
					2,
				].map((pageIndex) => page("all", pageIndex)),
			);
			expect(pages.map((result) => result.rowCount)).toEqual([
				6,
				6,
				6,
			]);
			expect(
				pages.flatMap((result) =>
					result.data.map((row) =>
						row.name.startsWith("F") ? row.id : row.name,
					),
				),
			).toEqual([
				`A own ${tag}`,
				`B own draft ${tag}`,
				`C shared ${tag}`,
				`E edited draft ${tag}`,
				...twins,
			]);

			const drafts = await page("draft", 0);
			expect(drafts.rowCount).toBe(2);
			expect(names(drafts)).toEqual([
				`B own draft ${tag}`,
				`E edited draft ${tag}`,
			]);

			const adminDrafts = await call(admin, (options) =>
				procedures.block.list(
					{
						filters: {
							type: "behaviour",
							search: tag,
							status: "draft",
						},
					},
					options,
				),
			);
			expect(names(adminDrafts)).toEqual([
				`D shared draft ${tag}`,
				`E edited draft ${tag}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"bot drafts show only to editors; tiles get owner, contents and model hint",
		async () => {
			const { admin, member, procedures, call, behaviour, share, toMember } =
				await organization();
			const tag = crypto.randomUUID();
			const behaviourId = await behaviour(admin, `Behaviour ${tag}`);
			const save = (name: string, status: "ready" | "draft") =>
				call(admin, (options) =>
					procedures.bot.save(
						{
							name,
							description: "Integration bot",
							status,
							behaviourId,
						},
						options,
					),
				);
			const { data: published } = await save(`Published ${tag}`, "ready");
			const { data: viewedDraft } = await save(`Viewed draft ${tag}`, "draft");
			const { data: editedDraft } = await save(`Edited draft ${tag}`, "draft");
			const bot = (resourceId: string) => ({
				resourceType: "bot" as const,
				resourceId,
			});
			await share(bot(published.id), "viewer", toMember);
			await share(bot(viewedDraft.id), "viewer", toMember);
			await share(bot(editedDraft.id), "editor", toMember);

			const { data: provider } = await call(admin, (options) =>
				procedures.provider.create(
					{
						name: `Library ${tag}`,
						description: "Serves the library test.",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			);
			const { data: model } = await call(admin, (options) =>
				procedures.model.create(
					{
						providerId: provider.id,
						providerModelId: `library-${tag}`,
						name: "Library model",
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
			await call(admin, (options) =>
				procedures.botSetup.save(
					{
						botId: published.id,
						setup: {
							modelId: model.id,
							strength: "required",
							generation: {},
						},
					},
					options,
				),
			);

			const list = (status: "ready" | "draft" | "all") =>
				call(member, (options) =>
					procedures.bot.list(
						{
							search: tag,
							sort: "newest",
							filters: {
								status,
							},
						},
						options,
					),
				);

			const all = await list("all");
			expect(all.data.map((row) => row.name)).toEqual([
				`Edited draft ${tag}`,
				`Published ${tag}`,
			]);
			expect((await list("draft")).data.map((row) => row.name)).toEqual([
				`Edited draft ${tag}`,
			]);
			expect((await list("ready")).data.map((row) => row.name)).toEqual([
				`Published ${tag}`,
			]);

			const tile = all.data.find((row) => row.id === published.id);
			expect(tile?.owner).toEqual({
				id: admin.user.id,
				name: admin.user.name,
				image: admin.user.image,
			});
			expect(tile?.contents).toEqual({
				behaviour: true,
				repositories: 0,
			});
			expect(tile?.modelHint).toEqual({
				strength: "required",
				modelName: "Library model",
			});
			expect(
				all.data.find((row) => row.id === editedDraft.id)?.modelHint,
			).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"bot pages, counts and favourites leave out drafts the user cannot edit",
		async () => {
			const { admin, member, procedures, call, share, toMember } =
				await organization();
			const tag = crypto.randomUUID();
			const save = async (
				name: string,
				status: "ready" | "draft",
				role: "viewer" | "editor",
			) => {
				const { data } = await call(admin, (options) =>
					procedures.bot.save(
						{
							name: `${name} ${tag}`,
							description: "Integration bot",
							status,
						},
						options,
					),
				);
				await share(
					{
						resourceType: "bot",
						resourceId: data.id,
					},
					role,
					toMember,
				);
				return data.id;
			};
			const readable = {
				a: await save("A published", "ready", "viewer"),
				b: await save("B edited draft", "draft", "editor"),
				c: await save("C published", "ready", "viewer"),
				d: await save("D edited published", "ready", "editor"),
				e: await save("E edited draft", "draft", "editor"),
			};
			await save("A0 viewed draft", "draft", "viewer");
			await save("C0 viewed draft", "draft", "viewer");
			for (const id of [
				readable.c,
				readable.d,
			]) {
				await call(member, (options) =>
					procedures.bot.setFavourite(
						{
							id,
							favourite: true,
						},
						options,
					),
				);
			}

			const pages = async (
				filters: {
					favourite?: boolean;
					scope?: "all" | "edit";
				},
				sort: "name" | "favouritesFirst",
			) => {
				const seen: string[] = [];
				const counts: number[] = [];
				for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
					const page = await call(member, (options) =>
						procedures.bot.list(
							{
								pageIndex,
								pageSize: 2,
								search: tag,
								sort,
								filters: {
									...filters,
									status: "all",
								},
							},
							options,
						),
					);
					seen.push(...page.data.map((row) => row.id));
					counts.push(page.rowCount);
				}
				return {
					seen,
					counts,
				};
			};

			expect(await pages({}, "name")).toEqual({
				seen: [
					readable.a,
					readable.b,
					readable.c,
					readable.d,
					readable.e,
				],
				counts: [
					5,
					5,
					5,
				],
			});
			expect(await pages({}, "favouritesFirst")).toEqual({
				seen: [
					readable.c,
					readable.d,
					readable.a,
					readable.b,
					readable.e,
				],
				counts: [
					5,
					5,
					5,
				],
			});
			expect(
				await pages(
					{
						favourite: true,
					},
					"name",
				),
			).toEqual({
				seen: [
					readable.c,
					readable.d,
				],
				counts: [
					2,
					2,
					2,
				],
			});
			expect(
				await pages(
					{
						scope: "edit",
					},
					"name",
				),
			).toEqual({
				seen: [
					readable.b,
					readable.d,
					readable.e,
				],
				counts: [
					3,
					3,
					3,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"contents read through their parent refuse a scope",
		async () => {
			const { member, procedures, call, behaviour } = await organization();
			const blockId = await behaviour(member, `Parent ${crypto.randomUUID()}`);
			const refused = (operation: Promise<unknown>) =>
				operation.then(
					() => "accepted",
					(error: { code?: string }) => error.code,
				);
			const { data: bot } = await call(member, (options) =>
				procedures.bot.save(
					{
						name: "Parent bot",
						description: "Integration bot",
						status: "draft",
						behaviourId: blockId,
					},
					options,
				),
			);

			expect(
				await refused(
					call(member, (options) =>
						procedures.block.list(
							{
								filters: {
									botId: bot.id,
									scope: "edit",
								},
							},
							options,
						),
					),
				),
			).toBe("BAD_REQUEST");
			expect(
				await refused(
					call(member, (options) =>
						procedures.asset.list(
							{
								filters: {
									repositoryId: blockId,
									scope: "all",
								},
							},
							options,
						),
					),
				),
			).toBe("BAD_REQUEST");
		},
		TIMEOUT,
	);

	test(
		"the processing filter narrows assets to running or failed ones",
		async () => {
			const { member, procedures, call, asset } = await organization();
			const assets: Record<PipelineStatus, AssetId> = {
				pending: await asset(member),
				active: await asset(member),
				completed: await asset(member),
				failed: await asset(member),
			};
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					for (const [status, id] of Object.entries(assets)) {
						yield* db
							.update(dbSchema.asset)
							.set({
								processingStatus: status as PipelineStatus,
							})
							.where(eq(dbSchema.asset.id, id));
					}
				}),
			);

			const list = (processing?: "running" | "failed") =>
				call(member, (options) =>
					procedures.asset.list(
						{
							filters: {
								processing,
							},
						},
						options,
					),
				);
			const ids = (page: {
				data: {
					id: AssetId;
				}[];
			}) => page.data.map((row) => row.id).sort();

			expect(ids(await list("running"))).toEqual(
				[
					assets.pending,
					assets.active,
				].sort(),
			);
			expect(ids(await list("failed"))).toEqual([
				assets.failed,
			]);
			expect((await list()).rowCount).toBe(4);
		},
		TIMEOUT,
	);

	test(
		"the suggestions filter lists assets with a pending suggestion the user can edit",
		async () => {
			const { admin, member, procedures, call, asset, share, toMember } =
				await organization();
			const own = await asset(member);
			const ownWithoutSuggestion = await asset(member);
			const edited = await asset(admin);
			const viewed = await asset(admin);
			const unshared = await asset(admin);
			const asset_ = (resourceId: AssetId) => ({
				resourceType: "asset" as const,
				resourceId,
			});
			await share(asset_(edited), "editor", toMember);
			await share(asset_(viewed), "viewer", toMember);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					for (const id of [
						own,
						edited,
						viewed,
						unshared,
					]) {
						yield* db
							.update(dbSchema.asset)
							.set({
								metadataSuggestion: {
									title: "Suggested",
									metadata: {},
								},
							})
							.where(eq(dbSchema.asset.id, id));
					}
				}),
			);

			const list = (filters: { suggestions?: true }) =>
				call(member, (options) =>
					procedures.asset.list(
						{
							filters,
						},
						options,
					),
				);
			const ids = (page: {
				data: {
					id: AssetId;
				}[];
			}) => page.data.map((row) => row.id).sort();

			// Read-only and unreadable assets with suggestions stay out.
			expect(
				ids(
					await list({
						suggestions: true,
					}),
				),
			).toEqual(
				[
					own,
					edited,
				].sort(),
			);
			expect(
				(
					await list({
						suggestions: true,
					})
				).rowCount,
			).toBe(2);
			expect(ids(await list({}))).toContain(ownWithoutSuggestion);
		},
		TIMEOUT,
	);

	test(
		"repository asset counts match the readiness summary",
		async () => {
			const { member, procedures, call, asset, token } = await organization();
			const tag = crypto.randomUUID();
			// Processing and indexing states, as assetState combines them.
			const states: [
				PipelineStatus,
				PipelineStatus,
			][] = [
				[
					"pending",
					"pending",
				],
				[
					"active",
					"pending",
				],
				[
					"failed",
					"pending",
				],
				[
					"completed",
					"pending",
				],
				[
					"completed",
					"active",
				],
				[
					"completed",
					"completed",
				],
				[
					"completed",
					"failed",
				],
			];
			const repositories: BlockId[] = [];
			for (const [index, size] of [
				0,
				7,
				21,
			].entries()) {
				const assetIds: AssetId[] = [];
				for (let count = 0; count < size; count++) {
					assetIds.push(await asset(member));
				}
				const { data } = await call(member, (options) =>
					procedures.block.create(
						{
							type: "repository",
							name: `Repository ${index} ${tag}`,
							description: null,
							contentJson: null,
							status: "ready",
							config: defaultRepositoryConfig,
							assets: assetIds,
						},
						options,
					),
				);
				repositories.push(data.id);
				await run(
					Effect.gen(function* () {
						const db = yield* DB;
						for (const [position, assetId] of assetIds.entries()) {
							const [processing, indexing] =
								states[(position + index) % states.length];
							yield* db
								.update(dbSchema.asset)
								.set({
									processingStatus: processing,
								})
								.where(eq(dbSchema.asset.id, assetId));
							yield* db
								.update(dbSchema.blockAsset)
								.set({
									indexStatus: indexing,
								})
								.where(
									and(
										eq(dbSchema.blockAsset.blockId, data.id),
										eq(dbSchema.blockAsset.assetId, assetId),
									),
								);
						}
					}),
				);
			}

			const [listed, readiness] = await Promise.all([
				call(member, (options) =>
					procedures.block.list(
						{
							filters: {
								type: "repository",
								search: tag,
							},
						},
						options,
					),
				),
				call(member, (options) =>
					procedures.block.readiness(
						{
							blockIds: repositories,
						},
						options,
					),
				),
			]);

			expect(listed.data).toHaveLength(3);

			// Totals come from one query per page, whatever the repositories hold.
			const statementsFor = async (search: string) => {
				const counting = countingStatements(
					await procedureOptions(member, token()),
				);
				await run(
					procedures.block.list(
						{
							filters: {
								type: "repository",
								search,
							},
						},
						counting.options,
					),
				);
				return counting.statements();
			};
			const emptyOnly = await statementsFor(`Repository 0 ${tag}`);
			expect(emptyOnly).toBeGreaterThan(0);
			expect(await statementsFor(tag)).toBe(emptyOnly);
			for (const repository of readiness.data) {
				expect(
					listed.data.find((row) => row.id === repository.blockId)?.assets,
				).toEqual(repository.totals);
			}
			expect(
				listed.data.map((row) => row.assets?.total ?? -1).sort((a, b) => a - b),
			).toEqual([
				0,
				7,
				21,
			]);
		},
		TIMEOUT,
	);

	test(
		"Mine stays inside the active organisation's library",
		async () => {
			const { member, procedures, call, behaviour, remember } =
				await organization();
			const tag = crypto.randomUUID();
			await behaviour(member, `Here ${tag}`);
			const { organization: elsewhere, zedToken } = await run(
				createOrganization({
					members: [
						{
							userId: member.user.id,
							role: "admin",
						},
					],
				}),
			);
			remember(zedToken);
			const away = await signIn(elsewhere.id, member.user.id);
			const { data: foreign } = await call(away, (options) =>
				procedures.block.create(
					{
						type: "behaviour",
						name: `Elsewhere ${tag}`,
						description: null,
						contentJson: null,
						status: "draft",
						config: {
							systemPrompt: "",
						},
					},
					options,
				),
			);

			const list = (actor: Actor) =>
				call(actor, (options) =>
					procedures.block.list(
						{
							filters: {
								search: tag,
								scope: "edit",
								status: "all",
							},
						},
						options,
					),
				);
			expect(names(await list(member))).toEqual([
				`Here ${tag}`,
			]);
			expect((await list(away)).data.map((row) => row.id)).toEqual([
				foreign.id,
			]);
		},
		TIMEOUT,
	);
});
