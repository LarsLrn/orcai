import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { asc, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import * as AppErrors from "@/lib/effect/utils/errors";

/**
 * Locks the actor's and the targets' accounts for the enclosing transaction
 * and fails unless the actor is still an unbanned instance admin, so admins
 * demoting, banning or deleting each other at once leave one standing.
 * Answers the targets' rows that exist.
 */
export const lockAsInstanceAdmin = (params: {
	actorId: UserId;
	userIds: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		// Locking in id order keeps two opposite actions from deadlocking.
		const rows = yield* db
			.select({
				id: dbSchema.user.id,
				role: dbSchema.user.role,
				banned: dbSchema.user.banned,
				email: dbSchema.user.email,
				name: dbSchema.user.name,
				locale: dbSchema.user.locale,
				twoFactorEnabled: dbSchema.user.twoFactorEnabled,
			})
			.from(dbSchema.user)
			.where(
				inArray(dbSchema.user.id, [
					params.actorId,
					...params.userIds,
				]),
			)
			.orderBy(asc(dbSchema.user.id))
			.for("update");

		const actor = rows.find(({ id }) => id === params.actorId);
		if (!isInstanceAdminRole(actor?.role) || actor?.banned)
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "INSTANCE_ADMIN_REQUIRED",
					message: "This action requires the instance administrator.",
					data: {
						permission: "administer_instance",
						entityType: "instance",
					},
				}),
			);

		return rows.filter(({ id }) => params.userIds.includes(id));
	});
