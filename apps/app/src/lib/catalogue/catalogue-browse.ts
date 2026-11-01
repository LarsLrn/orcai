import type { AssetId, BlockId, BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type CatalogueEntry,
	type CatalogueEntryDetail,
	type CatalogueEntryRef,
	type CatalogueKind,
	type CatalogueModelFilter,
	type ListCatalogueInput,
	modelUnusableReason,
	templateBlockSchema,
} from "@orcai/schema";
import {
	type AnyColumn,
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	not,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { inLibrary } from "@/lib/authz/library";
import { repositoryTotals } from "@/lib/blocks/readiness";
import * as AppErrors from "@/lib/effect/utils/errors";
import { botDetails } from "@/lib/library/tile-details";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";
import { literalSearch } from "@/lib/utils/literal-search";

/*
 * The catalogue: the published bots and blocks organisations list. Listing is
 * the authority (Postgres, so unlisting takes effect at once); anyone on the
 * instance may preview an entry.
 */

/** How many assets an entry's page previews. */
const ASSET_PREVIEW_SIZE = 5;

type EntryFilters = {
	kind?: CatalogueKind;
	search?: string;
	organizationIds?: readonly OrganizationId[];
	model?: CatalogueModelFilter;
	/** Leaves out what this organisation's library holds. */
	hideAddedIn?: OrganizationId;
	entry?: CatalogueEntryRef;
};

const home = alias(dbSchema.resourceScope, "home");

const homeOf = (resourceType: "bot" | "block", id: AnyColumn) =>
	and(
		eq(home.resourceType, resourceType),
		sql`${home.resourceId} = ${id}`,
		eq(home.isPrimary, true),
		isNull(home.endedAt),
	);

const listed = (resourceType: "bot" | "block", id: AnyColumn) => {
	const visibility = dbSchema.resourceVisibility;
	return sql`exists (
		select 1 from ${visibility}
		where ${visibility.resourceType} = ${resourceType}
			and ${visibility.resourceId} = ${id}
			and ${visibility.visibility} = 'public'
	)`;
};

/** Bots whose author's setup asks for a model with this strength, or for none. */
const modelCondition = (model: CatalogueModelFilter) => {
	if (model === "any") return undefined;
	const setup = dbSchema.botSetup;
	const asks = sql`exists (
		select 1 from ${setup}
		where ${setup.botId} = ${dbSchema.bot.id}
			and ${setup.organizationId} = ${home.organizationId}
			and ${setup.modelId} is not null
			${model === "none" ? sql`` : sql`and ${setup.strength} = ${model}`}
	)`;
	return model === "none" ? not(asks) : asks;
};

const blockKind = sql<CatalogueKind>`case when ${dbSchema.block.type} = 'template' then 'behaviour' else 'repository' end`;

/** Every entry the filters let through, as one subquery of kind, id, name, creation time and home. */
const entries = (filters: EntryFilters) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { kind, entry, model = "any" } = filters;
		const matches = (column: AnyColumn) =>
			filters.search ? ilike(column, literalSearch(filters.search)) : undefined;
		const fromOrganizations = filters.organizationIds?.length
			? inArray(home.organizationId, [
					...filters.organizationIds,
				])
			: undefined;
		const notAdded = (resourceType: "bot" | "block", id: AnyColumn) =>
			filters.hideAddedIn
				? not(inLibrary(resourceType, id, filters.hideAddedIn))
				: undefined;
		const fields = (
			entryKind: SQL<CatalogueKind>,
			table: {
				id: AnyColumn;
				name: AnyColumn;
				createdAt: AnyColumn;
			},
		) => ({
			kind: entryKind.as("kind"),
			id: sql<string>`${table.id}`.as("id"),
			name: sql<string>`${table.name}`.as("name"),
			createdAt: sql<Date | null>`${table.createdAt}`.as("created_at"),
			organizationId: sql<OrganizationId>`${home.organizationId}`.as(
				"organization_id",
			),
		});

		const wantsBots =
			(kind === undefined || kind === "bot") &&
			(entry === undefined || entry.resourceType === "bot");
		const wantsBlocks =
			kind !== "bot" &&
			model === "any" &&
			(entry === undefined || entry.resourceType === "block");

		const bots = db
			.select(fields(sql<CatalogueKind>`'bot'`, dbSchema.bot))
			.from(dbSchema.bot)
			.innerJoin(home, homeOf("bot", dbSchema.bot.id))
			.where(
				and(
					eq(dbSchema.bot.status, "ready"),
					listed("bot", dbSchema.bot.id),
					matches(dbSchema.bot.name),
					fromOrganizations,
					modelCondition(model),
					notAdded("bot", dbSchema.bot.id),
					entry?.resourceType === "bot"
						? eq(dbSchema.bot.id, entry.resourceId)
						: undefined,
					wantsBots ? undefined : sql`false`,
				),
			);
		const blocks = db
			.select(fields(blockKind, dbSchema.block))
			.from(dbSchema.block)
			.innerJoin(home, homeOf("block", dbSchema.block.id))
			.where(
				and(
					eq(dbSchema.block.status, "ready"),
					listed("block", dbSchema.block.id),
					matches(dbSchema.block.name),
					fromOrganizations,
					kind === "behaviour" || kind === "repository"
						? eq(
								dbSchema.block.type,
								kind === "behaviour" ? "template" : "database",
							)
						: undefined,
					notAdded("block", dbSchema.block.id),
					entry?.resourceType === "block"
						? eq(dbSchema.block.id, entry.resourceId)
						: undefined,
				),
			);

		if (wantsBots && wantsBlocks) return bots.unionAll(blocks).as("entries");
		return wantsBlocks ? blocks.as("entries") : bots.as("entries");
	});

/** How the entries relate to the organisation: home, added, or neither. */
const entryStates = (ids: readonly string[], organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const scopes =
			ids.length === 0
				? []
				: yield* (yield* DB)
						.select({
							resourceId: dbSchema.resourceScope.resourceId,
							isPrimary: dbSchema.resourceScope.isPrimary,
						})
						.from(dbSchema.resourceScope)
						.where(
							and(
								inArray(dbSchema.resourceScope.resourceId, [
									...ids,
								]),
								eq(dbSchema.resourceScope.organizationId, organizationId),
								isNull(dbSchema.resourceScope.endedAt),
							),
						);
		const byId = new Map(
			scopes.map((scope) => [
				scope.resourceId,
				scope.isPrimary,
			]),
		);
		return (id: string): CatalogueEntry["state"] => {
			const isPrimary = byId.get(id);
			return isPrimary === undefined
				? "available"
				: isPrimary
					? "home"
					: "added";
		};
	});

const homeOrganizationColumns = {
	id: dbSchema.organization.id,
	name: dbSchema.organization.name,
	logo: dbSchema.organization.logo,
};

/** Tiles for `page`, in its order; an entry deleted meanwhile drops out. */
const hydrate = (
	page: readonly {
		kind: CatalogueKind;
		id: string;
	}[],
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const botIds = page
			.filter((entry) => entry.kind === "bot")
			.map((entry) => entry.id as BotId);
		const blockIds = page
			.filter((entry) => entry.kind !== "bot")
			.map((entry) => entry.id as BlockId);

		const [bots, blocks, contents, totals, stateOf] = yield* Effect.all(
			[
				botIds.length === 0
					? Effect.succeed([])
					: db
							.select({
								id: dbSchema.bot.id,
								name: dbSchema.bot.name,
								description: dbSchema.bot.description,
								createdAt: dbSchema.bot.createdAt,
								owner: ownerColumns,
								homeOrganization: homeOrganizationColumns,
								strength: dbSchema.botSetup.strength,
								modelName: dbSchema.model.name,
							})
							.from(dbSchema.bot)
							.innerJoin(
								dbSchema.user,
								eq(dbSchema.user.id, dbSchema.bot.userId),
							)
							.innerJoin(home, homeOf("bot", dbSchema.bot.id))
							.innerJoin(
								dbSchema.organization,
								eq(dbSchema.organization.id, home.organizationId),
							)
							.leftJoin(
								dbSchema.botSetup,
								and(
									eq(dbSchema.botSetup.botId, dbSchema.bot.id),
									eq(dbSchema.botSetup.organizationId, home.organizationId),
								),
							)
							.leftJoin(
								dbSchema.model,
								eq(dbSchema.model.id, dbSchema.botSetup.modelId),
							)
							.where(inArray(dbSchema.bot.id, botIds)),
				blockIds.length === 0
					? Effect.succeed([])
					: db
							.select({
								id: dbSchema.block.id,
								type: dbSchema.block.type,
								name: dbSchema.block.name,
								description: dbSchema.block.description,
								createdAt: dbSchema.block.createdAt,
								owner: ownerColumns,
								homeOrganization: homeOrganizationColumns,
							})
							.from(dbSchema.block)
							.innerJoin(
								dbSchema.user,
								eq(dbSchema.user.id, dbSchema.block.userId),
							)
							.innerJoin(home, homeOf("block", dbSchema.block.id))
							.innerJoin(
								dbSchema.organization,
								eq(dbSchema.organization.id, home.organizationId),
							)
							.where(inArray(dbSchema.block.id, blockIds)),
				botDetails(botIds, undefined),
				repositoryTotals(blockIds),
				entryStates(
					page.map((entry) => entry.id),
					organizationId,
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		const tiles = new Map<string, CatalogueEntry>();
		for (const { strength, modelName, ...bot } of bots)
			tiles.set(bot.id, {
				...bot,
				kind: "bot",
				state: stateOf(bot.id),
				contents: contents(bot.id).contents,
				modelHint:
					strength && modelName
						? {
								strength,
								modelName,
							}
						: null,
				assets: null,
			});
		for (const { type, ...block } of blocks)
			tiles.set(block.id, {
				...block,
				kind: type === "template" ? "behaviour" : "repository",
				state: stateOf(block.id),
				contents: null,
				modelHint: null,
				assets: type === "database" ? totals(block.id).ready : null,
			});
		return page.flatMap((entry) => tiles.get(entry.id) ?? []);
	});

/**
 * One page of catalogue entries for the organisation's members, read in one
 * snapshot like `findCatalogueEntry`.
 */
export const listCatalogue = (
	input: ListCatalogueInput,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() => cataloguePage(input, organizationId), {
			isolationLevel: "repeatable read",
			accessMode: "read only",
		});
	});

const cataloguePage = (
	input: ListCatalogueInput,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const listedEntries = yield* entries({
			kind: input.kind,
			search: input.search,
			organizationIds: input.organizationIds,
			model: input.model,
			hideAddedIn: input.hideAdded ? organizationId : undefined,
		});
		const orderBy =
			input.sort === "name"
				? [
						asc(listedEntries.name),
						asc(listedEntries.id),
					]
				: [
						sql`${listedEntries.createdAt} desc nulls last`,
						desc(listedEntries.id),
					];

		const [page, [counted]] = yield* Effect.all(
			[
				db
					.select({
						kind: listedEntries.kind,
						id: listedEntries.id,
					})
					.from(listedEntries)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(listedEntries),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: yield* hydrate(page, organizationId),
			rowCount: counted.count,
		};
	});

/** How many entries of each kind the filters let through. */
const kindCounts = (filters: EntryFilters) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const matching = yield* entries(filters);
		const rows = yield* db
			.select({
				kind: matching.kind,
				count: count(),
			})
			.from(matching)
			.groupBy(matching.kind);
		const counts: Record<CatalogueKind, number> = {
			bot: 0,
			behaviour: 0,
			repository: 0,
		};
		for (const row of rows) counts[row.kind] = row.count;
		return counts;
	});

/**
 * How many entries each kind holds, matching `search`, and the organisations
 * that list entries, with how many each.
 */
export const catalogueCounts = (search: string | undefined) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const all = yield* entries({});
		return yield* Effect.all(
			{
				counts: kindCounts({
					search,
				}),
				organizations: db
					.select({
						...homeOrganizationColumns,
						entries: count(),
					})
					.from(all)
					.innerJoin(
						dbSchema.organization,
						eq(dbSchema.organization.id, all.organizationId),
					)
					.groupBy(dbSchema.organization.id)
					.orderBy(asc(dbSchema.organization.name)),
			},
			{
				concurrency: "unbounded",
			},
		);
	});

/** How many entries of each kind the organisation lists in the catalogue. */
export const listedCounts = (organizationId: OrganizationId) =>
	kindCounts({
		organizationIds: [
			organizationId,
		],
	});

/**
 * The organisation's chat model that runs the same provider model as the
 * bot's home setup, when a turn may use it.
 */
const authorsPick = (botId: BotId, organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authorModel = alias(dbSchema.model, "author_model");
		const authorProvider = alias(dbSchema.provider, "author_provider");
		const [match] = yield* db
			.select({
				id: dbSchema.model.id,
				capabilities: dbSchema.model.capabilities,
				isDeprecated: dbSchema.model.isDeprecated,
				providerEnabled: dbSchema.provider.enabled,
			})
			.from(dbSchema.botSetup)
			.innerJoin(home, homeOf("bot", dbSchema.botSetup.botId))
			.innerJoin(authorModel, eq(authorModel.id, dbSchema.botSetup.modelId))
			.innerJoin(authorProvider, eq(authorProvider.id, authorModel.providerId))
			.innerJoin(
				dbSchema.model,
				eq(dbSchema.model.providerModelId, authorModel.providerModelId),
			)
			.innerJoin(
				dbSchema.provider,
				and(
					eq(dbSchema.provider.id, dbSchema.model.providerId),
					eq(dbSchema.provider.kind, authorProvider.kind),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.where(
				and(
					eq(dbSchema.botSetup.botId, botId),
					eq(dbSchema.botSetup.organizationId, home.organizationId),
				),
			)
			.orderBy(
				desc(dbSchema.provider.enabled),
				asc(dbSchema.model.isDeprecated),
			)
			.limit(1);
		return match &&
			modelUnusableReason(
				{
					capabilities: match.capabilities,
					isDeprecated: match.isDeprecated,
					providerEnabled: match.providerEnabled,
				},
				"turn",
			) === undefined
			? match.id
			: null;
	});

/**
 * A bot's behaviour and repositories, with each repository's published
 * assets and how each relates to the organisation.
 */
const botBlocks = (botId: BotId, organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const blocks = yield* (yield* DB)
			.select({
				id: dbSchema.block.id,
				name: dbSchema.block.name,
				type: dbSchema.block.type,
				description: dbSchema.block.description,
			})
			.from(dbSchema.botBlock)
			.innerJoin(
				dbSchema.block,
				eq(dbSchema.block.id, dbSchema.botBlock.blockId),
			)
			.where(eq(dbSchema.botBlock.botId, botId))
			.orderBy(desc(dbSchema.block.type), asc(dbSchema.block.name));
		const [totals, stateOf] = yield* Effect.all([
			repositoryTotals(
				blocks
					.filter((block) => block.type === "database")
					.map((block) => block.id),
			),
			entryStates(
				blocks.map((block) => block.id),
				organizationId,
			),
		]);
		return blocks.map((block) => ({
			...block,
			state: stateOf(block.id),
			type:
				block.type === "template"
					? ("template" as const)
					: ("database" as const),
			assets: block.type === "database" ? totals(block.id).ready : null,
		}));
	});

/** A repository's first published assets. */
const assetPreview = (blockId: BlockId) =>
	Effect.gen(function* () {
		const rows = yield* (yield* DB)
			.select({
				id: dbSchema.asset.id,
				title: dbSchema.asset.title,
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(
				and(
					eq(dbSchema.blockAsset.blockId, blockId),
					eq(dbSchema.asset.processingStatus, "completed"),
					eq(dbSchema.blockAsset.indexStatus, "completed"),
				),
			)
			.orderBy(asc(dbSchema.asset.title), asc(dbSchema.asset.id))
			.limit(ASSET_PREVIEW_SIZE);
		return rows.map((row) => ({
			id: row.id as AssetId,
			title: row.title,
		}));
	});

/**
 * A catalogue entry with what its page shows; not found unless it is listed.
 * Every query reads one snapshot, so content saved after an unlisting never
 * shows with the listing read before it.
 */
export const findCatalogueEntry = (
	entry: CatalogueEntryRef,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() => entryDetail(entry, organizationId), {
			isolationLevel: "repeatable read",
			accessMode: "read only",
		});
	});

const entryDetail = (
	entry: CatalogueEntryRef,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const matching = yield* entries({
			entry,
		});
		const [tile] = yield* hydrate(
			yield* db
				.select({
					kind: matching.kind,
					id: matching.id,
				})
				.from(matching),
			organizationId,
		);
		if (!tile)
			return yield* new AppErrors.NotFoundError({
				reason:
					entry.resourceType === "bot" ? "BOT_NOT_FOUND" : "BLOCK_NOT_FOUND",
				id: entry.resourceId,
				message: "This entry is not in the catalogue.",
			});

		const detail: CatalogueEntryDetail = {
			...tile,
			blocks: [],
			authorsPick: null,
			prompt: null,
			assetPreview: [],
		};
		switch (entry.resourceType) {
			case "bot": {
				const [blocks, pick] = yield* Effect.all(
					[
						botBlocks(entry.resourceId, organizationId),
						tile.modelHint
							? authorsPick(entry.resourceId, organizationId)
							: Effect.succeed(null),
					],
					{
						concurrency: "unbounded",
					},
				);
				return {
					...detail,
					blocks,
					authorsPick: pick,
				};
			}
			case "block": {
				if (tile.kind === "repository")
					return {
						...detail,
						assetPreview: yield* assetPreview(entry.resourceId),
					};
				const [block] = yield* db
					.select({
						config: dbSchema.block.config,
					})
					.from(dbSchema.block)
					.where(eq(dbSchema.block.id, entry.resourceId));
				const config = templateBlockSchema.shape.config.safeParse(
					block?.config,
				);
				return {
					...detail,
					prompt: config.success ? config.data.systemPrompt : null,
				};
			}
		}
	});
