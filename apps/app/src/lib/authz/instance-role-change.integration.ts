import { describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { InstanceRole } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Client } from "pg";
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

/** Holds both rows from another connection until both changes wait on them. */
const queueBehindRowLocks = async (
	users: Actor[],
	operations: (() => Promise<unknown>)[],
) => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query(`SELECT id FROM "user" WHERE id = ANY($1) FOR UPDATE`, [
			users.map(({ user }) => user.id),
		]);
		const outcomes = operations.map((operation) =>
			Promise.allSettled([
				operation(),
			]).then(([outcome]) => outcome),
		);
		const deadline = Date.now() + 20_000;
		for (;;) {
			// Statistics views keep one snapshot per transaction otherwise.
			await client.query("SELECT pg_stat_clear_snapshot()");
			const { rows } = await client.query<{
				waiting: number;
			}>(
				`SELECT count(*)::int AS waiting FROM pg_stat_activity
				 WHERE wait_event_type = 'Lock' AND query ILIKE '%from "user"%for update%'`,
			);
			if (rows[0].waiting >= operations.length) break;
			if (Date.now() > deadline)
				throw new Error("Timed out waiting for both changes to queue");
			await sleep(25);
		}
		await client.query("COMMIT");
		return await Promise.all(outcomes);
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
		await client.end();
	}
};

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

	test(
		"two admins demoting each other at once leave one admin",
		async () => {
			const { organizationId } = await organizationWith([
				"member",
			]);
			const first = await instanceAdmin(organizationId);
			const second = await instanceAdmin(organizationId);

			const outcomes = await queueBehindRowLocks(
				[
					first,
					second,
				],
				[
					() => setRole(first, second, "user"),
					() => setRole(second, first, "user"),
				],
			);

			expect(outcomes.map(({ status }) => status).sort()).toEqual([
				"fulfilled",
				"rejected",
			]);
			const rejected = outcomes.find(
				(outcome) => outcome.status === "rejected",
			);
			expect(rejected?.reason).toMatchObject({
				reason: "INSTANCE_ADMIN_REQUIRED",
			});
			expect(
				[
					await roleOf(first),
					await roleOf(second),
				].sort(),
			).toEqual([
				"admin",
				"user",
			]);
		},
		TIMEOUT,
	);
});
