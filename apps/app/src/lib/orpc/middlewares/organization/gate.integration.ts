import { describe, expect, test } from "bun:test";
import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createUser, reasonOf, rolledBack } from "@orcai/testing";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { currentActiveOrganization } from "@/lib/authz/organization-access";
import { AuthzService } from "@/lib/effect/services/authz";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { router } from "@/lib/orpc/router";
import {
	type Actor,
	appIntegration,
	failingWritesAbout,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const {
	run,
	signIn,
	organizationWith,
	instanceAdmin,
	caller,
	procedureOptions,
} = appIntegration();

const procedures = await run(Procedures);

type AppContext = Awaited<
	ReturnType<typeof procedureOptions>
>["context"]["effect/context"];

const { call, observe } = caller();

/** Procedures that act on the caller's own records or a resource, not in the active organisation. */
const OUTSIDE_ORGANIZATION = new Set([
	"activity.attention",
	"activity.dismissFailure",
	"activity.dismissRun",
	"activity.runMembers",
	"activity.runs",
	"activity.summary",
	"ai.recordTurnWrites",
	"asset.addToLibrary",
	"asset.delete",
	"asset.dismissMetadataSuggestion",
	"asset.generateMetadata",
	"asset.prepareAgain",
	"asset.save",
	"assetPoint.browseRepository",
	"assetPoint.searchRepositories",
	"assetPoint.searchRepository",
	"block.delete",
	"block.prepareAssetAgain",
	"block.prepareFailedAgain",
	"block.update",
	"bootstrap.initialize",
	"bootstrap.status",
	"bot.delete",
	"bot.setFavourite",
	"catalogue.counts",
	"chat.delete",
	"chat.find",
	"chat.history",
	"chat.pin",
	"chatBlock.list",
	"chatMessage.find",
	"chatMessage.list",
	"chatMessage.listRatings",
	"chatMessage.rate",
	"dataExport.latest",
	"dataExport.request",
	"instanceSettings.embeddingsStatus",
	"organization.list",
	"organization.profile",
	"organizationInvitation.find",
	"organizationInvitation.listMine",
	"organizationInvitation.respond",
	"organizationInvitation.validate",
	"resource.getVisibility",
	"resource.listingImpact",
	"resource.setVisibility",
	"storage.abortMultipartUpload",
	"storage.completeMultipartUpload",
	"storage.createDownloadUrl",
	"storage.createUploadUrls",
	"user.me",
	"user.removeImage",
	"user.setActiveOrganization",
	"user.setImage",
	"user.setTourState",
	"user.updatePassword",
]);

type RouterNode = {
	"~orpc"?: {
		orderedMiddlewares: readonly {
			middleware: {
				name: string;
			};
		}[];
	};
};

const middlewareNames = (
	node: unknown,
	path: readonly string[] = [],
): [
	string,
	string[],
][] => {
	const procedure = (node as RouterNode)["~orpc"];
	if (procedure)
		return [
			[
				path.join("."),
				procedure.orderedMiddlewares.map(({ middleware }) => middleware.name),
			],
		];
	return Object.entries(node as object).flatMap(([key, child]) =>
		middlewareNames(child, [
			...path,
			key,
		]),
	);
};

/** Changes a member row behind SpiceDB's back, as a write whose tuples have not arrived. */
const quietly = {
	setRole: (
		organizationId: OrganizationId,
		userId: UserId,
		role: "admin" | "member",
	) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.member)
					.set({
						role,
					})
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, userId),
						),
					);
			}),
		),
	remove: (organizationId: OrganizationId, userId: UserId) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.delete(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, userId),
						),
					);
			}),
		),
};

describe("organisation gate", () => {
	test("every procedure acting in an organisation passes the gate", () => {
		const ungated = middlewareNames(router)
			.filter(
				([, names]) =>
					!names.some(
						(name) =>
							name.startsWith("requireOrganization") ||
							name === "requireInstanceAdmin",
					),
			)
			.map(([path]) => path)
			.sort();

		expect(ungated).toEqual(
			[
				...OUTSIDE_ORGANIZATION,
			].sort(),
		);
	});

	test(
		"a demoted admin loses admin procedures and capabilities before their tuples follow",
		async () => {
			const {
				organizationId,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			observe(zedToken);
			const capabilities = () =>
				call(admin, (options) =>
					procedures.authorization.organizationCapabilities(
						{
							permissions: [
								"manage_models",
								"read",
							],
						},
						options,
					),
				);
			expect((await capabilities()).data.capabilities).toMatchObject({
				manage_models: true,
				read: true,
			});

			await quietly.setRole(organizationId, admin.user.id, "member");

			expect(
				await reasonOf(
					call(admin, (options) =>
						procedures.readiness.organization({}, options),
					),
				),
			).toBe("PERMISSION_DENIED");
			expect((await capabilities()).data.capabilities).toMatchObject({
				manage_models: false,
				read: true,
			});
			expect(
				(
					await call(admin, (options) =>
						procedures.authorization.check(
							{
								entityType: "organization",
								entityId: organizationId,
								permission: "manage_organization",
							},
							options,
						),
					)
				).data.allowed,
			).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"a removed member is refused everywhere before their tuples follow",
		async () => {
			const {
				organizationId,
				actors: [member],
				zedToken,
			} = await organizationWith([
				"member",
			]);
			observe(zedToken);
			await quietly.remove(organizationId, member.user.id);

			const reasons = await Promise.all([
				reasonOf(call(member, (options) => procedures.bot.list({}, options))),
				reasonOf(
					call(member, (options) => procedures.library.counts({}, options)),
				),
				reasonOf(
					call(member, (options) =>
						procedures.authorization.organizationCapabilities(
							{
								permissions: [
									"read",
								],
							},
							options,
						),
					),
				),
				reasonOf(
					call(member, (options) =>
						procedures.organization.find(
							{
								id: organizationId,
							},
							options,
						),
					),
				),
				reasonOf(call(member, (options) => procedures.model.list({}, options))),
			]);
			expect(new Set(reasons)).toEqual(
				new Set([
					"ORGANIZATION_MEMBERSHIP_REVOKED",
				]),
			);
		},
		TIMEOUT,
	);

	test(
		"an organisation named in the input is checked itself, whichever is active",
		async () => {
			const {
				organizationId: active,
				actors: [elsewhere],
				zedToken: activeToken,
			} = await organizationWith([
				"admin",
			]);
			const {
				organizationId: target,
				actors: [admin, viewer],
				zedToken: targetToken,
			} = await organizationWith([
				"admin",
				"viewer",
			]);
			observe(activeToken);
			observe(targetToken);
			const withoutActive = (actor: typeof admin) => ({
				...actor,
				session: {
					...actor.session,
					activeOrganizationId: null,
				},
			});
			const rename = (actor: typeof admin) =>
				reasonOf(
					call(actor, (options) =>
						procedures.organization.update(
							{
								id: target,
								name: "Renamed",
							},
							options,
						),
					),
				);
			const find = (actor: typeof admin) =>
				reasonOf(
					call(actor, (options) =>
						procedures.organization.find(
							{
								id: target,
							},
							options,
						),
					),
				);

			expect(await rename(elsewhere)).toBe("PERMISSION_DENIED");
			expect(await find(elsewhere)).toBe("PERMISSION_DENIED");
			expect(await rename(withoutActive(viewer))).toBe("PERMISSION_DENIED");
			expect(await find(withoutActive(viewer))).toBeUndefined();
			expect(await rename(withoutActive(admin))).toBeUndefined();
			expect(active).not.toBe(target);
		},
		TIMEOUT,
	);

	test(
		"a committed grant SpiceDB does not hold yet answers 503 ACCESS_PENDING",
		async () => {
			const newcomer = await run(createUser());
			const {
				organizationId: joining,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const instance = await instanceAdmin(joining);
			const newcomerSession = await signIn(joining, newcomer.id);
			const spice = failingWritesAbout(newcomer.id, "unavailable");

			const outcomes = await run(
				rolledBack(
					Effect.gen(function* () {
						// The transaction's own context, so the procedures write inside it
						// and deliver through the failing SpiceDB.
						const context = Context.add(
							(yield* Effect.context<never>()) as AppContext,
							AuthzService,
							yield* AuthzService,
						);
						const optionsFor = (
							actor: Actor,
							activeOrganizationId: OrganizationId | null,
						) => ({
							context: {
								"effect/context": context,
								"effect/wrap": mapEffectErrors,
								reqHeaders: new Headers(),
								secureCookies: false,
								meta: {
									zedToken,
								},
								auth: {
									isAuthenticated: true as const,
									session: {
										...actor.session,
										activeOrganizationId,
									},
									user: actor.user,
								},
							},
						});
						const asNewcomer = (organizationId: OrganizationId) =>
							optionsFor(newcomerSession, organizationId);
						const outcome = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
							effect.pipe(
								Effect.as(undefined),
								Effect.catch((error) =>
									Effect.succeed(
										error instanceof ORPCError
											? `${error.code} ${
													(
														error.data as {
															reason?: string;
														}
													).reason
												}`
											: String(error),
									),
								),
							);

						const { data: created } = yield* procedures.organization.create(
							{
								name: "Pending",
								slug: `pending-${crypto.randomUUID()}`,
								initialAdmin: {
									kind: "user",
									userId: newcomer.id,
								},
							},
							optionsFor(instance, joining),
						);
						const createdAdmin = yield* outcome(
							procedures.readiness.organization({}, asNewcomer(created.id)),
						);

						const [invitation] = yield* (yield* DB)
							.insert(dbSchema.invitation)
							.values({
								organizationId: joining,
								email: newcomer.email,
								role: "viewer",
								status: "pending",
								expiresAt: new Date(Date.now() + 3_600_000),
							})
							.returning();
						yield* procedures.organizationInvitation.respond(
							{
								id: invitation.id,
								response: "accept",
							},
							optionsFor(newcomerSession, null),
						);
						const invitedViewer = yield* outcome(
							procedures.model.list({}, asNewcomer(joining)),
						);

						yield* procedures.organizationMember.update(
							{
								userId: newcomer.id,
								role: "admin",
							},
							optionsFor(admin, joining),
						);
						const promotedAdmin = yield* outcome(
							procedures.readiness.organization({}, asNewcomer(joining)),
						);

						return [
							createdAdmin,
							invitedViewer,
							promotedAdmin,
						];
					}),
				).pipe(Effect.provide(spice.authz)),
			).finally(spice.close);

			expect(outcomes).toEqual([
				"SERVICE_UNAVAILABLE ACCESS_PENDING",
				"SERVICE_UNAVAILABLE ACCESS_PENDING",
				"SERVICE_UNAVAILABLE ACCESS_PENDING",
			]);
		},
		TIMEOUT,
	);

	test(
		"the token a membership write returns admits the user at once",
		async () => {
			const {
				organizationId,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const newcomer = await run(createUser());
			const promoter = caller(zedToken);

			const instance = await instanceAdmin(organizationId);
			const { data: created } = await promoter.call(instance, (options) =>
				procedures.organization.create(
					{
						name: "Created",
						slug: `created-${crypto.randomUUID()}`,
						initialAdmin: {
							kind: "user",
							userId: newcomer.id,
						},
					},
					options,
				),
			);
			const createdAdmin = await signIn(created.id, newcomer.id);
			expect(
				await reasonOf(
					promoter.call(createdAdmin, (options) =>
						procedures.readiness.organization({}, options),
					),
				),
			).toBeUndefined();

			const member = await run(createUser());
			await promoter.call(admin, (options) =>
				procedures.organizationInvitation.create(
					{
						role: "member",
						expiresAt: new Date(Date.now() + 3_600_000),
						items: [
							{
								email: member.email,
							},
						],
					},
					options,
				),
			);
			const signedIn = await signIn(organizationId, member.id);
			const invited = {
				...signedIn,
				session: {
					...signedIn.session,
					activeOrganizationId: null,
				},
			};
			const [invitation] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							id: dbSchema.invitation.id,
						})
						.from(dbSchema.invitation)
						.where(eq(dbSchema.invitation.email, member.email));
				}),
			);
			await promoter.call(invited, (options) =>
				procedures.organizationInvitation.respond(
					{
						id: invitation.id,
						response: "accept",
					},
					options,
				),
			);
			const joined = await signIn(organizationId, member.id);
			expect(
				await reasonOf(
					promoter.call(joined, (options) =>
						procedures.model.list({}, options),
					),
				),
			).toBeUndefined();

			await promoter.call(admin, (options) =>
				procedures.organizationMember.update(
					{
						userId: member.id,
						role: "admin",
					},
					options,
				),
			);
			expect(
				await reasonOf(
					promoter.call(joined, (options) =>
						procedures.readiness.organization({}, options),
					),
				),
			).toBeUndefined();
		},
		TIMEOUT,
	);

	test(
		"a session keeps its active organisation only while the user is a member there",
		async () => {
			const {
				organizationId,
				actors: [staying, leaving],
			} = await organizationWith([
				"member",
				"member",
			]);
			const outcome = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.delete(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.userId, leaving.user.id),
							),
						);
					const active = [
						yield* currentActiveOrganization(staying.session),
						yield* currentActiveOrganization(leaving.session),
					];
					const stored = yield* db
						.select({
							id: dbSchema.session.id,
							activeOrganizationId: dbSchema.session.activeOrganizationId,
						})
						.from(dbSchema.session)
						.where(
							inArray(dbSchema.session.id, [
								staying.session.id,
								leaving.session.id,
							]),
						);
					return {
						active,
						stored: Object.fromEntries(
							stored.map((row) => [
								row.id,
								row.activeOrganizationId,
							]),
						),
					};
				}),
			);

			expect(outcome).toEqual({
				active: [
					organizationId,
					null,
				],
				stored: {
					[staying.session.id]: organizationId,
					[leaving.session.id]: null,
				},
			});
		},
		TIMEOUT,
	);
});
