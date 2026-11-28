import { describe, expect, test } from "bun:test";
import type { OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { BetterAuth } from "@/lib/auth/better-auth";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller } = appIntegration();

/**
 * Fails every `event` on `table` whose new row points at `organizationId`
 * until `restore` is called.
 */
const failWritesInto = async (
	table: "member" | "session",
	event: "INSERT" | "UPDATE",
	column: "organization_id" | "active_organization_id",
	organizationId: OrganizationId,
) => {
	const name = `signup_fault_${crypto.randomUUID().replaceAll("-", "")}`;
	await run(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db.execute(
				sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
					BEGIN RAISE EXCEPTION 'injected sign-up failure'; END $$`),
			);
			yield* db.execute(
				sql.raw(`CREATE TRIGGER ${name} BEFORE ${event} ON "${table}" FOR EACH ROW
					WHEN (NEW.${column} = '${organizationId}') EXECUTE FUNCTION ${name}()`),
			);
		}),
	);
	return () =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.execute(
					sql.raw(`DROP TRIGGER IF EXISTS ${name} ON "${table}"`),
				);
				yield* db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${name}()`));
			}),
		);
};

/** An organization with an admin who has invited a newcomer without an account. */
const invitedNewcomer = async () => {
	const auth = await run(BetterAuth);
	const procedures = await run(Procedures);
	const {
		organizationId,
		actors: [admin],
		zedToken,
	} = await organizationWith([
		"admin",
	]);
	const email = `newcomer-${crypto.randomUUID()}@example.test`;
	const password = "a-password-long-enough";
	const { call } = caller(zedToken);
	const {
		data: [invitation],
	} = await call(admin, (options) =>
		procedures.organizationInvitation.create(
			{
				role: "member",
				expiresAt: new Date(Date.now() + 86_400_000),
				items: [
					{
						email,
					},
				],
			},
			options,
		),
	);

	/** Posts the sign-up form, which sends the invitation as an extra body field. */
	const signUp = () => {
		const { baseURL } = auth.options;
		return auth.handler(
			new Request(`${baseURL}/api/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: baseURL,
				},
				body: JSON.stringify({
					email,
					password,
					name: "Newcomer",
					invitationId: invitation.id,
				}),
			}),
		);
	};

	/** Signs in with the password chosen at sign-up, as the newcomer's new session. */
	const signIn = async () => {
		const { token } = await auth.api.signInEmail({
			body: {
				email,
				password,
			},
		});
		return run(
			Effect.gen(function* () {
				const db = yield* DB;
				const [session] = yield* db
					.select()
					.from(dbSchema.session)
					.where(eq(dbSchema.session.token, token));
				const [user] = yield* db
					.select()
					.from(dbSchema.user)
					.where(eq(dbSchema.user.id, session.userId));
				return {
					session,
					user,
				};
			}),
		);
	};

	const membershipOf = (userId: typeof dbSchema.user.$inferSelect.id) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				return yield* db
					.select({
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, userId),
						),
					);
			}),
		);

	return {
		procedures,
		call,
		organizationId,
		invitation,
		signUp,
		signIn,
		membershipOf,
	};
};

describe("sign-up through an invitation", () => {
	test(
		"a newcomer whose membership failed after the account was created can still join",
		async () => {
			const s = await invitedNewcomer();

			const restore = await failWritesInto(
				"member",
				"INSERT",
				"organization_id",
				s.organizationId,
			);
			const signUp = await s.signUp().finally(restore);
			expect(signUp.ok).toBe(false);

			const newcomer = await s.signIn();
			const pending = await s.call(newcomer, (options) =>
				s.procedures.organizationInvitation.listMine(
					{
						filters: {
							status: "pending",
						},
						pageIndex: 0,
						pageSize: 12,
					},
					options,
				),
			);
			expect(pending.data.map(({ id }) => id)).toEqual([
				s.invitation.id,
			]);

			await s.call(newcomer, (options) =>
				s.procedures.organizationInvitation.respond(
					{
						id: s.invitation.id,
						response: "accept",
					},
					options,
				),
			);

			expect(await s.membershipOf(newcomer.user.id)).toEqual([
				{
					role: "member",
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"a newcomer whose session was not pointed at the joined organization enters it on the next sign-in",
		async () => {
			const s = await invitedNewcomer();

			const restore = await failWritesInto(
				"session",
				"UPDATE",
				"active_organization_id",
				s.organizationId,
			);
			const signUp = await s.signUp().finally(restore);
			expect(signUp.ok).toBe(false);

			const newcomer = await s.signIn();

			expect(newcomer.session.activeOrganizationId).toBe(s.organizationId);
			expect(await s.membershipOf(newcomer.user.id)).toEqual([
				{
					role: "member",
				},
			]);
		},
		TIMEOUT,
	);
});
