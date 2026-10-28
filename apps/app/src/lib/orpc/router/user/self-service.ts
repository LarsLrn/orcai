import { DB, dbSchema } from "@orcai/db";
import { checkEntityPermission } from "@orcai/spice-db";
import { and, eq, ne } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { touchOrganizationRoles } from "@/lib/authz/organization-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { removeImage, setImage } from "@/lib/images/images";
import { authed } from "@/lib/orpc/implementation/authed";
import { requirePreferencesMiddleware } from "@/lib/orpc/middlewares/auth";
import { permissionDenied } from "@/lib/orpc/middlewares/permission";

const me = authed.user.me.effect(function* ({ context }) {
	const db = yield* DB;

	return yield* db.query.user
		.findFirst({
			where: {
				id: {
					eq: context.auth.user.id,
				},
			},
		})
		.pipe(
			Effect.flatMap((user) =>
				Effect.fromNullishOr(user).pipe(
					Effect.mapError(
						() =>
							new AppErrors.NotFoundError({
								reason: "USER_NOT_FOUND",
								message: "User not found",
							}),
					),
				),
			),
			Effect.map((user) => ({
				data: user,
			})),
		);
});

const updatePassword = authed.user.updatePassword.effect(function* ({
	input,
	context,
}) {
	const db = yield* DB;

	const ctx = yield* Effect.promise(() => auth.$context);

	const passwordMatches = yield* db.query.account
		.findFirst({
			where: {
				userId: {
					eq: context.auth.user.id,
				},
				providerId: "credential",
			},
		})
		.pipe(
			Effect.flatMap((account) =>
				Effect.fromNullishOr(account?.password).pipe(
					Effect.mapError(
						() =>
							new AppErrors.NotFoundError({
								reason: "PASSWORD_NOT_SET",
								message: "No password found for the user",
							}),
					),
				),
			),
			Effect.flatMap((passwordHash) =>
				Effect.promise(() =>
					ctx.password.verify({
						password: input.currentPassword,
						hash: passwordHash,
					}),
				),
			),
		);

	if (!passwordMatches) {
		return yield* Effect.fail(
			new AppErrors.UnauthorizedError({
				reason: "CURRENT_PASSWORD_INCORRECT",
				message: "Current password is incorrect",
			}),
		);
	}

	yield* Effect.promise(() => ctx.password.hash(input.password)).pipe(
		Effect.flatMap((newHash) =>
			Effect.promise(() =>
				ctx.internalAdapter.updatePassword(context.auth.user.id, newHash),
			),
		),
	);

	// Other sessions are revoked; the one making the change stays signed in.
	yield* db
		.delete(dbSchema.session)
		.where(
			and(
				eq(dbSchema.session.userId, context.auth.user.id),
				ne(dbSchema.session.id, context.auth.session.id),
			),
		);

	return {
		success: true,
	};
});

const setTourState = authed.user.setTourState
	.use(requirePreferencesMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		yield* db
			.update(dbSchema.user)
			.set({
				preferences: {
					...context.preferences,
					tours: {
						...context.preferences?.tours,
						[input.tourId]: input.state,
					},
				},
			})
			.where(eq(dbSchema.user.id, context.auth.user.id));

		return {
			success: true,
		};
	});

const setActiveOrganization = authed.user.setActiveOrganization.effect(
	function* ({ input, context }) {
		const db = yield* DB;
		const [membership] = yield* db
			.select({
				role: dbSchema.member.role,
			})
			.from(dbSchema.member)
			.where(
				and(
					eq(dbSchema.member.organizationId, input.organizationId),
					eq(dbSchema.member.userId, context.auth.user.id),
				),
			)
			.limit(1);

		if (!membership) {
			return yield* Effect.fail(
				permissionDenied({
					entityType: "organization",
					permission: "read",
				}),
			);
		}

		const hasSpiceAccess = yield* checkEntityPermission({
			entityId: input.organizationId,
			entityType: "organization",
			permission: "read",
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		}).pipe(Effect.catch(() => Effect.succeed(false)));

		if (!hasSpiceAccess) {
			yield* touchOrganizationRoles({
				userId: context.auth.user.id,
				organizationIds: [
					input.organizationId,
				],
			});
		}

		yield* db
			.update(dbSchema.session)
			.set({
				activeOrganizationId: input.organizationId,
			})
			.where(eq(dbSchema.session.id, context.auth.session.id));

		return {
			success: true,
		};
	},
);

const setUserImage = authed.user.setImage.effect(function* ({
	input,
	context,
}) {
	const image = yield* setImage({
		owner: {
			kind: "user",
			userId: context.auth.user.id,
		},
		uploaderId: context.auth.user.id,
		file: input.file,
	});

	return {
		data: {
			image,
		},
	};
});

const removeUserImage = authed.user.removeImage.effect(function* ({ context }) {
	yield* removeImage({
		kind: "user",
		userId: context.auth.user.id,
	});

	return {
		success: true,
	};
});

export const selfServiceRouter = {
	me,
	setImage: setUserImage,
	removeImage: removeUserImage,
	updatePassword,
	setTourState,
	setActiveOrganization,
};
