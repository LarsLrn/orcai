import { INSTANCE_ADMIN_ROLE, normalizeEmail } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { count, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { insertOrganization } from "@/lib/authz/organization-lifecycle";
import { writeRelationships } from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";
import { os } from "@/lib/orpc/implementation/os";

const toCount = (value: number | string | bigint | null | undefined) =>
	Number(value ?? 0);

let initializedCache: true | undefined;

const getInitializedState = (db: { select: typeof DB.Service.select }) =>
	Effect.gen(function* () {
		if (initializedCache) {
			return true;
		}

		// Users count as well: deleting the last organisation must not reopen bootstrap.
		const [userCountResult, organizationCountResult] = yield* Effect.all(
			[
				db
					.select({
						count: count(),
					})
					.from(dbSchema.user)
					.pipe(Effect.map(([result]) => result)),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.organization)
					.pipe(Effect.map(([result]) => result)),
			],
			{
				concurrency: "unbounded",
			},
		);

		const initialized =
			toCount(userCountResult.count) > 0 ||
			toCount(organizationCountResult.count) > 0;

		if (initialized) {
			initializedCache = true;
		}

		return initialized;
	});

const getBootstrapStatus = os.bootstrap.status.effect(function* () {
	const db = yield* DB;
	const initialized = yield* getInitializedState(db);

	return {
		data: {
			initialized,
		},
	};
});

const initializeBootstrap = os.bootstrap.initialize.effect(function* ({
	input,
}) {
	const db = yield* DB;
	const authContext = yield* Effect.promise(() => auth.$context);
	const email = normalizeEmail(input.email);
	const now = new Date();
	const passwordHash = yield* Effect.promise(() =>
		authContext.password.hash(input.password),
	);

	const {
		result: { userId, organizationId },
	} = yield* writeRelationships(
		{
			organizationIds: [],
		},
		Effect.gen(function* () {
			// Ensure only one bootstrap transaction can pass the initialized check.
			yield* db.execute(
				sql`LOCK TABLE "organization" IN ACCESS EXCLUSIVE MODE`,
			);

			const initialized = yield* getInitializedState(db);

			if (initialized) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "INSTANCE_ALREADY_INITIALISED",
						message: "Application is already initialized.",
					}),
				);
			}

			const [existingUser] = yield* db
				.select({
					id: dbSchema.user.id,
				})
				.from(dbSchema.user)
				.where(eq(dbSchema.user.email, email))
				.limit(1);

			if (existingUser) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "EMAIL_ALREADY_REGISTERED",
						message: "A user with this email already exists.",
					}),
				);
			}

			const [newUser] = yield* db
				.insert(dbSchema.user)
				.values({
					email,
					name: input.name,
					emailVerified: false,
					role: INSTANCE_ADMIN_ROLE,
					createdAt: now,
					updatedAt: now,
				})
				.returning({
					id: dbSchema.user.id,
				});

			const user = yield* Effect.fromNullishOr(newUser).pipe(
				Effect.mapError(
					() =>
						new AppErrors.BadRequestError({
							reason: "BOOTSTRAP_USER_CREATE_FAILED",
							message: "Failed to create bootstrap user.",
						}),
				),
			);

			yield* db.insert(dbSchema.account).values({
				accountId: user.id,
				providerId: "credential",
				userId: user.id,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});

			const organization = yield* insertOrganization({
				values: {
					name: input.organizationName,
					slug: input.organizationSlug.trim().toLowerCase(),
				},
				adminUserId: user.id,
				now,
			});

			return {
				userId: user.id,
				organizationId: organization.id,
			};
		}),
	);

	initializedCache = true;

	return {
		data: {
			userId,
			organizationId,
		},
	};
});

export const bootstrapRouter = {
	status: getBootstrapStatus,
	initialize: initializeBootstrap,
};
