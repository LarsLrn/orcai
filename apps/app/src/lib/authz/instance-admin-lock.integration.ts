import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { awaitLockWaiters } from "@orcai/testing";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Client } from "pg";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	authzIntegration();

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
		await run(awaitLockWaiters('%from "user"%for update%', operations.length));
		await client.query("COMMIT");
		return await Promise.all(outcomes);
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
		await client.end();
	}
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
