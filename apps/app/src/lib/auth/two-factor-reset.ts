import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { and, eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";

/**
 * Takes away an account's second factor so its owner can sign in with the
 * password alone: the TOTP secret and backup codes, the trusted devices and
 * every session go, and the owner gets an email. Nobody resets their own.
 */
export const resetTwoFactor = (params: { userId: UserId; actorId: UserId }) =>
	Effect.gen(function* () {
		if (params.userId === params.actorId)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "SELF_TWO_FACTOR_RESET_FORBIDDEN",
					message: "You cannot reset your own two-factor authentication.",
				}),
			);

		const db = yield* DB;
		const { config } = yield* AppConfigService;

		yield* db.transaction(() =>
			Effect.gen(function* () {
				const [user] = yield* db
					.update(dbSchema.user)
					.set({
						twoFactorEnabled: false,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.user.id, params.userId))
					.returning({
						email: dbSchema.user.email,
						name: dbSchema.user.name,
						locale: dbSchema.user.locale,
					});
				if (!user)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "USER_NOT_FOUND",
							id: params.userId,
							message: "User not found",
						}),
					);

				yield* db
					.delete(dbSchema.twoFactor)
					.where(eq(dbSchema.twoFactor.userId, params.userId));
				// Better Auth keeps a trusted device as a verification value
				// holding the user id.
				yield* db
					.delete(dbSchema.verification)
					.where(
						and(
							like(dbSchema.verification.identifier, "trust-device-%"),
							eq(dbSchema.verification.value, params.userId),
						),
					);
				yield* db
					.delete(dbSchema.session)
					.where(eq(dbSchema.session.userId, params.userId));

				yield* enqueueNotification(
					{
						type: "auth.two-factor-reset",
						recipient: user.email,
						recipientName: user.name,
						securityUrl: `${config.auth.url}/app/account/security`,
						locale: user.locale ?? "en",
					},
					`auth.two-factor-reset:${crypto.randomUUID()}`,
				);
			}),
		);
	});
