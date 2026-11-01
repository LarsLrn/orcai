import {
	ORGANIZATION_ROLES,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Roles that may own content: every role that can create it. */
export const OWNER_ROLES = ORGANIZATION_ROLES.filter(
	(role) => role !== "viewer",
);

/** The user is not banned, or their ban has expired. */
export const notBanned = () =>
	or(
		isNull(dbSchema.user.banned),
		eq(dbSchema.user.banned, false),
		lt(dbSchema.user.banExpires, new Date()),
	);

/**
 * Which of `userIds` may own content in the organisation: members there with
 * a role that creates content, and not banned. Read it under the
 * organisation's lock for an answer that holds until commit.
 */
export const eligibleOwnerIds = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) return new Set<UserId>();
		const db = yield* DB;
		const rows = yield* db
			.select({
				userId: dbSchema.member.userId,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					inArray(dbSchema.member.userId, [
						...params.userIds,
					]),
					inArray(dbSchema.member.role, OWNER_ROLES),
					notBanned(),
				),
			);
		return new Set(rows.map((row) => row.userId));
	});

/**
 * Fails unless the user may own content in the organisation. Call it under
 * the organisation's lock, where the creation it guards commits.
 */
export const requireEligibleOwner = (params: {
	organizationId: OrganizationId;
	userId: UserId;
}) =>
	eligibleOwnerIds({
		organizationId: params.organizationId,
		userIds: [
			params.userId,
		],
	}).pipe(
		Effect.filterOrFail(
			(eligible) => eligible.has(params.userId),
			() =>
				new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message:
						"Only a member who can create content in this organization can own it.",
					data: {
						entityType: "organization",
					},
				}),
		),
		Effect.asVoid,
	);
