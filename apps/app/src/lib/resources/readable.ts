import type {
	AssetId,
	BlockId,
	BotId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { NamedResource, ResourceIdentity } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { and, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableNow } from "@/lib/authz/content-access";
import { inLibrary } from "@/lib/authz/library";
import { unique } from "@/lib/utils/array-utils";

/**
 * The given bots, blocks and assets the user can read in the organisation's
 * library, with their current names. Missing and unreadable ones are left out.
 */
export const readableResources = (params: {
	resources: readonly ResourceIdentity[];
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken: string | undefined;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { userId, organizationId, zedToken } = params;
		const idsOf = <Type extends ResourceIdentity["resourceType"]>(type: Type) =>
			unique(
				params.resources.flatMap((resource) =>
					resource.resourceType === type
						? [
								resource.resourceId as Extract<
									ResourceIdentity,
									{
										resourceType: Type;
									}
								>["resourceId"],
							]
						: [],
				),
			);
		const permitted = <Type extends ResourceIdentity["resourceType"]>(
			type: Type,
		) => {
			const ids = idsOf(type);
			return ids.length === 0
				? Effect.succeed([])
				: permittedEntityIds({
						entityIds: ids,
						entityType: type,
						permission: "read",
						userId,
						zedToken,
					}).pipe(
						Effect.map((granted) => [
							...granted,
						]),
					);
		};

		const [bots, blocks, assets] = yield* Effect.all(
			[
				permitted("bot").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										id: dbSchema.bot.id,
										name: dbSchema.bot.name,
									})
									.from(dbSchema.bot)
									.where(
										and(
											inArray(dbSchema.bot.id, ids as BotId[]),
											inLibrary("bot", dbSchema.bot.id, organizationId),
											readableNow("bot", dbSchema.bot.id, userId),
										),
									),
					),
				),
				permitted("block").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										id: dbSchema.block.id,
										name: dbSchema.block.name,
									})
									.from(dbSchema.block)
									.where(
										and(
											inArray(dbSchema.block.id, ids as BlockId[]),
											inLibrary("block", dbSchema.block.id, organizationId),
											readableNow("block", dbSchema.block.id, userId),
										),
									),
					),
				),
				permitted("asset").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										id: dbSchema.asset.id,
										name: dbSchema.asset.title,
									})
									.from(dbSchema.asset)
									.where(
										and(
											inArray(dbSchema.asset.id, ids as AssetId[]),
											inLibrary("asset", dbSchema.asset.id, organizationId),
											readableNow("asset", dbSchema.asset.id, userId),
										),
									),
					),
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		return [
			...bots.map(
				({ id, name }): NamedResource => ({
					resourceType: "bot",
					resourceId: id,
					name,
				}),
			),
			...blocks.map(
				({ id, name }): NamedResource => ({
					resourceType: "block",
					resourceId: id,
					name,
				}),
			),
			...assets.map(
				({ id, name }): NamedResource => ({
					resourceType: "asset",
					resourceId: id,
					name,
				}),
			),
		];
	});
