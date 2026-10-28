import type { BotId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { UsageBot, UsagePerson } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { unique } from "@/lib/utils/array-utils";

type Viewer = {
	userId: UserId;
	zedToken?: string;
};

/**
 * Names the people and bots of usage rows as `viewer` may see them: people
 * through their current membership of the organisation, bots the viewer can
 * read. Everyone else is a former member, every other bot is "other".
 */
export const usageIdentities = (params: {
	organizationId: OrganizationId;
	viewer: Viewer;
	userIds: readonly UserId[];
	botIds: readonly (BotId | null)[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { user, member, bot } = dbSchema;
		const userIds = unique(params.userIds);
		const botIds = unique(
			params.botIds.filter((botId): botId is BotId => botId !== null),
		);

		const [members, bots] = yield* Effect.all(
			[
				userIds.length > 0
					? db
							.select({
								id: user.id,
								name: user.name,
								email: user.email,
							})
							.from(member)
							.innerJoin(user, eq(user.id, member.userId))
							.where(
								and(
									eq(member.organizationId, params.organizationId),
									inArray(member.userId, userIds),
								),
							)
					: Effect.succeed([]),
				botIds.length > 0
					? db
							.select({
								id: bot.id,
								name: bot.name,
							})
							.from(bot)
							.where(inArray(bot.id, botIds))
					: Effect.succeed([]),
			],
			{
				concurrency: "unbounded",
			},
		);
		const readable = yield* permittedEntityIds({
			entityType: "bot",
			entityIds: bots.map(({ id }) => id),
			permission: "read",
			userId: params.viewer.userId,
			zedToken: params.viewer.zedToken,
		});

		const people = new Map(
			members.map((person) => [
				person.id,
				person,
			]),
		);
		const botNames = new Map(
			bots.flatMap(({ id, name }) =>
				readable.has(id)
					? [
							[
								id,
								name,
							] as const,
						]
					: [],
			),
		);

		return {
			person: (userId: UserId): UsagePerson => {
				const person = people.get(userId);
				return person
					? {
							kind: "member",
							...person,
						}
					: {
							kind: "former",
						};
			},
			bot: (botId: BotId | null): UsageBot => {
				if (botId === null)
					return {
						kind: "none",
					};
				const name = botNames.get(botId);
				return name === undefined
					? {
							kind: "other",
						}
					: {
							kind: "bot",
							id: botId,
							name,
						};
			},
		};
	});

/** Rows whose `userId` is a current member named or addressed like `pattern`. */
export const memberMatching = (
	organizationId: OrganizationId,
	userId: AnyPgColumn,
	pattern: string,
): SQL => {
	const { user, member } = dbSchema;
	return sql`exists (select 1 from ${member} inner join ${user} on ${user.id} = ${member.userId}
		where ${member.userId} = ${userId}
			and ${member.organizationId} = ${organizationId}
			and (${user.name} ilike ${pattern} or ${user.email} ilike ${pattern}))`;
};
