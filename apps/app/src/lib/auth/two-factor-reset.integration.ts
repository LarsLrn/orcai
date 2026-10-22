import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
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

/** What Better Auth leaves behind for an enrolled user who trusted a device. */
const enrol = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const expiresAt = new Date(Date.now() + 3_600_000);
			yield* db
				.update(dbSchema.user)
				.set({
					twoFactorEnabled: true,
				})
				.where(eq(dbSchema.user.id, actor.user.id));
			yield* db.insert(dbSchema.twoFactor).values({
				userId: actor.user.id,
				secret: "encrypted-secret",
				backupCodes: "encrypted-codes",
			});
			yield* db.insert(dbSchema.verification).values([
				{
					id: crypto.randomUUID(),
					identifier: `trust-device-${crypto.randomUUID()}`,
					value: actor.user.id,
					expiresAt,
				},
				{
					id: crypto.randomUUID(),
					identifier: `unrelated-${crypto.randomUUID()}`,
					value: actor.user.id,
					expiresAt,
				},
			]);
		}),
	);

const leftoversOf = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [user] = yield* db
				.select({
					twoFactorEnabled: dbSchema.user.twoFactorEnabled,
				})
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, actor.user.id));
			const twoFactors = yield* db
				.select()
				.from(dbSchema.twoFactor)
				.where(eq(dbSchema.twoFactor.userId, actor.user.id));
			const verifications = yield* db
				.select({
					identifier: dbSchema.verification.identifier,
				})
				.from(dbSchema.verification)
				.where(eq(dbSchema.verification.value, actor.user.id));
			const sessions = yield* db
				.select()
				.from(dbSchema.session)
				.where(eq(dbSchema.session.userId, actor.user.id));
			const emails = yield* db
				.select()
				.from(dbSchema.notificationOutbox)
				.where(
					and(
						eq(dbSchema.notificationOutbox.recipient, actor.user.email),
						eq(dbSchema.notificationOutbox.type, "auth.two-factor-reset"),
					),
				);
			return {
				twoFactorEnabled: user.twoFactorEnabled,
				twoFactors: twoFactors.length,
				verifications: verifications.map(
					({ identifier }) => identifier.split("-")[0],
				),
				sessions: sessions.length,
				emails: emails.length,
			};
		}),
	);

describe("user.resetTwoFactor", () => {
	test(
		"an instance admin removes the second factor, trusted devices and sessions, and the user gets an email",
		async () => {
			const {
				organizationId,
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			await signIn(organizationId, member.user.id);
			await enrol(member);
			const admin = await instanceAdmin(organizationId);
			const procedures = await run(Procedures);

			await run(
				procedures.user.resetTwoFactor(
					{
						userId: member.user.id,
					},
					await procedureOptions(admin),
				),
			);

			expect(await leftoversOf(member)).toEqual({
				twoFactorEnabled: false,
				twoFactors: 0,
				verifications: [
					"unrelated",
				],
				sessions: 0,
				emails: 1,
			});
			expect((await leftoversOf(admin)).sessions).toBe(1);
		},
		TIMEOUT,
	);

	test(
		"an instance admin cannot reset their own",
		async () => {
			const { organizationId } = await organizationWith([
				"member",
			]);
			const admin = await instanceAdmin(organizationId);
			await enrol(admin);
			const procedures = await run(Procedures);

			expect(
				await rejection(
					run(
						procedures.user.resetTwoFactor(
							{
								userId: admin.user.id,
							},
							await procedureOptions(admin),
						),
					),
				),
			).toMatchObject({
				reason: "SELF_TWO_FACTOR_RESET_FORBIDDEN",
			});
			expect((await leftoversOf(admin)).twoFactorEnabled).toBe(true);
		},
		TIMEOUT,
	);
});
