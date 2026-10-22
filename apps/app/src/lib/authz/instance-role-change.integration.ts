import { describe, expect, test } from "bun:test";
import type { InstanceRole } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, signIn, instanceAdmin } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const setRole = async (actor: Actor, target: Actor, role: InstanceRole) => {
	const procedures = await run(Procedures);
	return run(
		procedures.user.setInstanceRole(
			{
				userId: target.user.id,
				role,
			},
			await procedureOptions(actor),
		),
	);
};

const roleOf = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [user] = yield* db
				.select({
					role: dbSchema.user.role,
				})
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, actor.user.id));
			return user.role;
		}),
	);

const emailsTo = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const rows = yield* db
				.select({
					type: dbSchema.notificationOutbox.type,
					payload: dbSchema.notificationOutbox.payload,
				})
				.from(dbSchema.notificationOutbox)
				.where(
					and(
						eq(dbSchema.notificationOutbox.recipient, actor.user.email),
						like(dbSchema.notificationOutbox.type, "auth.instance-admin-%"),
					),
				)
				.orderBy(dbSchema.notificationOutbox.createdAt);
			return rows;
		}),
	);

describe("user.setInstanceRole", () => {
	test(
		"an instance admin promotes and demotes an account, which gets an email each time",
		async () => {
			const {
				organizationId,
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const admin = await instanceAdmin(organizationId);
			const procedures = await run(Procedures);

			await setRole(admin, member, "admin");
			expect(await roleOf(member)).toBe("admin");
			const promoted = await signIn(organizationId, member.user.id);
			await run(
				procedures.user.listAll(
					{
						pageIndex: 0,
						pageSize: 1,
					},
					await procedureOptions(promoted),
				),
			);

			await setRole(admin, member, "admin");
			await setRole(admin, member, "user");
			expect(await roleOf(member)).toBe("user");
			const demoted = await signIn(organizationId, member.user.id);
			expect(
				await rejection(
					run(
						procedures.user.listAll(
							{
								pageIndex: 0,
								pageSize: 1,
							},
							await procedureOptions(demoted),
						),
					),
				),
			).toMatchObject({
				reason: "INSTANCE_ADMIN_REQUIRED",
			});

			expect(await emailsTo(member)).toEqual([
				{
					type: "auth.instance-admin-granted",
					payload: expect.objectContaining({
						twoFactorRequired: false,
					}),
				},
				{
					type: "auth.instance-admin-revoked",
					payload: expect.anything(),
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"an organisation admin cannot change an instance role",
		async () => {
			const {
				actors: [organizationAdmin, member],
			} = await organizationWith([
				"admin",
				"member",
			]);

			expect(
				await rejection(setRole(organizationAdmin, member, "admin")),
			).toMatchObject({
				reason: "INSTANCE_ADMIN_REQUIRED",
			});
			expect(await roleOf(member)).toBe("user");
		},
		TIMEOUT,
	);

	test(
		"an instance admin cannot demote themselves",
		async () => {
			const { organizationId } = await organizationWith([
				"member",
			]);
			const admin = await instanceAdmin(organizationId);

			expect(await rejection(setRole(admin, admin, "user"))).toMatchObject({
				reason: "SELF_INSTANCE_ROLE_CHANGE_FORBIDDEN",
			});
			expect(await roleOf(admin)).toBe("admin");
		},
		TIMEOUT,
	);
});
