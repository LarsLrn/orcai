import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { awaitLockWaiters, holdLock } from "@orcai/testing";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	appIntegration();

/** Holds both rows in a transaction of its own until both changes wait on them. */
const queueBehindRowLocks = async (
	users: Actor[],
	operations: (() => Promise<unknown>)[],
) => {
	const release = await run(
		holdLock(
			Effect.gen(function* () {
				yield* (yield* DB)
					.select({
						id: dbSchema.user.id,
					})
					.from(dbSchema.user)
					.where(
						inArray(
							dbSchema.user.id,
							users.map(({ user }) => user.id),
						),
					)
					.for("update");
			}),
		),
	);
	const outcomes = operations.map((operation) =>
		Promise.allSettled([
			operation(),
		]).then(([outcome]) => outcome),
	);
	try {
		await run(awaitLockWaiters('%from "user"%for update%', operations.length));
	} finally {
		await run(release);
	}
	return Promise.all(outcomes);
};

/** What is left of two accounts: their instance role, or "banned" or "deleted". */
const standing = (admins: Actor[]) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const rows = yield* db
				.select({
					id: dbSchema.user.id,
					role: dbSchema.user.role,
					banned: dbSchema.user.banned,
				})
				.from(dbSchema.user)
				.where(
					inArray(
						dbSchema.user.id,
						admins.map(({ user }) => user.id),
					),
				);
			return admins
				.map(({ user }) => {
					const row = rows.find(({ id }) => id === user.id);
					if (!row) return "deleted";
					return row.banned ? "banned" : row.role;
				})
				.sort();
		}),
	);

const actions = {
	demote: async (actor: Actor, target: Actor) =>
		(await run(Procedures)).user.setInstanceRole(
			{
				userId: target.user.id,
				role: "user",
			},
			await procedureOptions(actor),
		),
	ban: async (actor: Actor, target: Actor) =>
		(await run(Procedures)).user.ban(
			{
				userId: target.user.id,
			},
			await procedureOptions(actor),
		),
	delete: async (actor: Actor, target: Actor) =>
		(await run(Procedures)).user.delete(
			{
				userIds: [
					target.user.id,
				],
			},
			await procedureOptions(actor),
		),
};

describe("two instance admins acting on each other at once", () => {
	for (const [action, outcome] of [
		[
			"demote",
			"user",
		],
		[
			"ban",
			"banned",
		],
		[
			"delete",
			"deleted",
		],
	] as const)
		test(
			`leave one admin when they ${action} each other`,
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
						async () => run(await actions[action](first, second)),
						async () => run(await actions[action](second, first)),
					],
				);

				expect(outcomes.map(({ status }) => status).sort()).toEqual([
					"fulfilled",
					"rejected",
				]);
				expect(
					outcomes.find((result) => result.status === "rejected")?.reason,
				).toMatchObject({
					reason: "INSTANCE_ADMIN_REQUIRED",
				});
				expect(
					await standing([
						first,
						second,
					]),
				).toEqual(
					[
						"admin",
						outcome,
					].sort(),
				);
			},
			TIMEOUT,
		);
});

describe("unbanning", () => {
	const unban = async (actor: Actor, userId: string) =>
		run(
			(await run(Procedures)).user.unban(
				{
					userId: userId as Actor["user"]["id"],
				},
				await procedureOptions(actor),
			),
		);

	test(
		"lifts a ban, unless the admin was banned in the meantime",
		async () => {
			const {
				organizationId,
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const first = await instanceAdmin(organizationId);
			const second = await instanceAdmin(organizationId);
			await run(await actions.ban(second, member));
			await run(await actions.ban(second, first));

			expect(
				await unban(first, member.user.id).then(
					() => undefined,
					(error: { reason?: string }) => error.reason,
				),
			).toBe("INSTANCE_ADMIN_REQUIRED");
			expect(
				await standing([
					member,
				]),
			).toEqual([
				"banned",
			]);

			await unban(second, member.user.id);
			expect(
				await standing([
					member,
				]),
			).toEqual([
				"user",
			]);
			expect(
				await unban(second, crypto.randomUUID()).then(
					() => undefined,
					(error: { reason?: string }) => error.reason,
				),
			).toBe("USER_NOT_FOUND");
		},
		TIMEOUT,
	);
});
