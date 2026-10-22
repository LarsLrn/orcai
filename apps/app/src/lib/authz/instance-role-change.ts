import {
	INSTANCE_ADMIN_ROLE,
	type InstanceRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { asc, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { requiresTwoFactor } from "@/lib/auth/two-factor-policy";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";

/**
 * Makes an account an instance administrator or a user again, and emails its
 * owner. Nobody changes their own role, and the actor's role is read again
 * under a lock on both rows, so concurrent demotions always leave an
 * administrator.
 */
export const setInstanceRole = (params: {
	userId: UserId;
	role: InstanceRole;
	actorId: UserId;
}) =>
	Effect.gen(function* () {
		if (params.userId === params.actorId)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "SELF_INSTANCE_ROLE_CHANGE_FORBIDDEN",
					message: "You cannot change your own instance role.",
				}),
			);

		const db = yield* DB;
		const { config } = yield* AppConfigService;

		yield* db.transaction(() =>
			Effect.gen(function* () {
				// Locking in id order keeps two opposite changes from deadlocking.
				const rows = yield* db
					.select({
						id: dbSchema.user.id,
						role: dbSchema.user.role,
						email: dbSchema.user.email,
						name: dbSchema.user.name,
						locale: dbSchema.user.locale,
						twoFactorEnabled: dbSchema.user.twoFactorEnabled,
					})
					.from(dbSchema.user)
					.where(
						inArray(dbSchema.user.id, [
							params.userId,
							params.actorId,
						]),
					)
					.orderBy(asc(dbSchema.user.id))
					.for("update");
				const actor = rows.find(({ id }) => id === params.actorId);
				const user = rows.find(({ id }) => id === params.userId);

				if (!isInstanceAdminRole(actor?.role))
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
				if (!user)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "USER_NOT_FOUND",
							id: params.userId,
							message: "User not found",
						}),
					);
				if (user.role === params.role) return;

				yield* db
					.update(dbSchema.user)
					.set({
						role: params.role,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.user.id, params.userId));

				const recipient = {
					recipient: user.email,
					recipientName: user.name,
					securityUrl: `${config.auth.url}/app/account/security`,
					locale: user.locale ?? "en",
				};
				yield* params.role === INSTANCE_ADMIN_ROLE
					? enqueueNotification(
							{
								type: "auth.instance-admin-granted",
								...recipient,
								twoFactorRequired: requiresTwoFactor(
									config.auth.twoFactorPolicy,
									{
										role: params.role,
										twoFactorEnabled: user.twoFactorEnabled,
									},
								),
							},
							`auth.instance-admin-granted:${crypto.randomUUID()}`,
						)
					: enqueueNotification(
							{
								type: "auth.instance-admin-revoked",
								...recipient,
							},
							`auth.instance-admin-revoked:${crypto.randomUUID()}`,
						);
			}),
		);
	});
