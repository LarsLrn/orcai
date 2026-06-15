import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { count, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { AuthzService } from "@/lib/effect/services/authz";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";

const toCount = (value: number | string | bigint | null | undefined) =>
	Number(value ?? 0);

let initializedCache: true | undefined;

const getInitializedState = (db: { select: typeof DB.Service.select }) =>
	Effect.gen(function* () {
		// Initialization is monotonic: once true, it never becomes false again.
		if (initializedCache) {
			return true;
		}

		const [organizationCountResult] = yield* db
			.select({
				count: count(),
			})
			.from(dbSchema.organization);

		const initialized = toCount(organizationCountResult.count) > 0;

		if (initialized) {
			initializedCache = true;
		}

		return initialized;
	});

export const getBootstrapStatus = os.bootstrap.status.handler(() =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;
			const initialized = yield* getInitializedState(db);

			return {
				data: {
					initialized,
				},
			};
		}),
	),
);

export const initializeBootstrap = os.bootstrap.initialize.handler(
	async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;
				const authContext = yield* Effect.promise(() => auth.$context);
				const email = input.email.trim().toLowerCase();
				const now = new Date();
				const passwordHash = yield* Effect.promise(() =>
					authContext.password.hash(input.password),
				);

				const { userId, organizationId, allMembersGroupId } =
					yield* db.transaction((tx) =>
						Effect.gen(function* () {
							// Ensure only one bootstrap transaction can pass the initialized check.
							yield* tx.execute(
								sql`LOCK TABLE "organization" IN ACCESS EXCLUSIVE MODE`,
							);

							const initialized = yield* getInitializedState(tx);

							if (initialized) {
								return yield* Effect.fail(
									errors.BAD_REQUEST({
										message: "Application is already initialized.",
									}),
								);
							}

							const [existingUser] = yield* tx
								.select({
									id: dbSchema.user.id,
								})
								.from(dbSchema.user)
								.where(eq(dbSchema.user.email, email))
								.limit(1);

							if (existingUser) {
								return yield* Effect.fail(
									errors.BAD_REQUEST({
										message: "A user with this email already exists.",
									}),
								);
							}

							const [newUser] = yield* tx
								.insert(dbSchema.user)
								.values({
									email,
									name: input.name,
									emailVerified: false,
									createdAt: now,
									updatedAt: now,
								})
								.returning({
									id: dbSchema.user.id,
								});

							const user = yield* Effect.fromNullishOr(newUser).pipe(
								Effect.mapError(() =>
									errors.BAD_REQUEST({
										message: "Failed to create bootstrap user.",
									}),
								),
							);

							yield* tx.insert(dbSchema.account).values({
								accountId: user.id,
								providerId: "credential",
								userId: user.id,
								password: passwordHash,
								createdAt: now,
								updatedAt: now,
							});

							const [newOrganization] = yield* tx
								.insert(dbSchema.organization)
								.values({
									name: input.organizationName,
									slug: input.organizationSlug.trim().toLowerCase(),
									createdAt: now,
								})
								.returning({
									id: dbSchema.organization.id,
								});

							const organization = yield* Effect.fromNullishOr(
								newOrganization,
							).pipe(
								Effect.mapError(() =>
									errors.BAD_REQUEST({
										message: "Failed to create bootstrap organisation.",
									}),
								),
							);

							yield* tx.insert(dbSchema.member).values({
								organizationId: organization.id,
								userId: user.id,
								role: "owner",
								createdAt: now,
							});

							const [allMembersGroup] = yield* tx
								.insert(dbSchema.group)
								.values({
									organizationId: organization.id,
									name: "All Members",
									description:
										"System group containing all organisation members",
									kind: "system",
									systemKey: ALL_MEMBERS_GROUP_SYSTEM_KEY,
									createdBy: user.id,
									createdAt: now,
									updatedAt: now,
									deletedAt: null,
								})
								.returning({
									id: dbSchema.group.id,
								});

							return {
								userId: user.id,
								organizationId: organization.id,
								allMembersGroupId: allMembersGroup.id,
							};
						}),
					);

				yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "organization",
							resourceId: organizationId,
							relation: "owner",
							subjectType: "user",
							subjectId: userId,
							operation: "touch",
						},
					],
				});

				yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "organization",
							subjectType: "organization",
							subjectId: organizationId,
							operation: "touch",
						},
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "member",
							subjectType: "organization",
							subjectId: organizationId,
							subjectRelation: "owner",
							operation: "touch",
						},
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "member",
							subjectType: "organization",
							subjectId: organizationId,
							subjectRelation: "instructor",
							operation: "touch",
						},
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "member",
							subjectType: "organization",
							subjectId: organizationId,
							subjectRelation: "student",
							operation: "touch",
						},
					],
				});

				initializedCache = true;

				return {
					data: {
						userId,
						organizationId,
					},
				};
			}),
		),
);
