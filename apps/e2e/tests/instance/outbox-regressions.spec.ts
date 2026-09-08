import { randomUUID } from "node:crypto";
import { userIdSchema } from "@orcai/schema";
import { Client } from "pg";
import { createApiClient } from "../../fixtures/api";
import { attemptSignUp, signIn, signUpInvited } from "../../fixtures/auth";
import { USER_PASSWORD } from "../../fixtures/constants";
import { test as base, expect } from "../../fixtures/index";

type OutboxFaults = {
	/** The e2e database, which this spec alone reads and writes directly. */
	db: Client;
	/** Arm the injection for outbox payloads mentioning `target`. */
	fault: (target: string, mode: string) => Promise<void>;
	/** The newest outbox row whose payload mentions `target`. */
	latest: (target: string) => Promise<any>;
};

const INSTALL = `DROP TRIGGER IF EXISTS e2e_outbox_fault ON authz_outbox;
   DROP FUNCTION IF EXISTS e2e_outbox_fault();
   DROP TABLE IF EXISTS e2e_outbox_fault;
   CREATE TABLE e2e_outbox_fault (target text, mode text);
   CREATE FUNCTION e2e_outbox_fault() RETURNS trigger LANGUAGE plpgsql AS $$
   DECLARE fault record;
   BEGIN
    SELECT * INTO fault FROM e2e_outbox_fault LIMIT 1;
    IF fault.target IS NOT NULL AND position(fault.target in NEW.payload_json::text) > 0 THEN
     IF fault.mode = 'rollback' THEN RAISE EXCEPTION 'injected outbox enqueue failure'; END IF;
     IF fault.mode = 'delay' THEN NEW.next_attempt_at := now() + interval '1 hour'; END IF;
     IF fault.mode = 'fail' THEN
      NEW.payload_json := jsonb_set(NEW.payload_json::jsonb || jsonb_build_object('original', NEW.payload_json), '{mutations,0,resourceType}', '"invalid_e2e_resource"'::jsonb);
     END IF;
    END IF;
    RETURN NEW;
   END $$;
   CREATE TRIGGER e2e_outbox_fault BEFORE INSERT ON authz_outbox FOR EACH ROW EXECUTE FUNCTION e2e_outbox_fault();`;

const UNINSTALL = `DROP TRIGGER IF EXISTS e2e_outbox_fault ON authz_outbox;
   DROP FUNCTION IF EXISTS e2e_outbox_fault();
   DROP TABLE IF EXISTS e2e_outbox_fault;`;

/**
 * The trigger is instance-wide, so its removal runs as fixture teardown, which
 * Playwright reaches even when the test body times out.
 */
const test = base.extend<{
	faults: OutboxFaults;
}>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies from this pattern.
	faults: async ({}, use) => {
		const db = new Client({
			host: process.env.POSTGRES_HOST,
			port: Number(process.env.POSTGRES_PORT),
			user: process.env.POSTGRES_USER,
			password: process.env.POSTGRES_PASSWORD,
			database: process.env.POSTGRES_DB,
		});
		await db.connect();

		try {
			await db.query(INSTALL);
			await use({
				db,
				fault: async (target, mode) => {
					await db.query("DELETE FROM e2e_outbox_fault");
					await db.query("INSERT INTO e2e_outbox_fault VALUES ($1, $2)", [
						target,
						mode,
					]);
				},
				latest: async (target) =>
					(
						await db.query(
							"SELECT * FROM authz_outbox WHERE payload_json::text LIKE $1 ORDER BY seq DESC LIMIT 1",
							[
								`%${target}%`,
							],
						)
					).rows[0],
			});
		} finally {
			await db.query(UNINSTALL);
			await db.query(
				"UPDATE authz_outbox SET payload_json = COALESCE(payload_json->'original', payload_json), next_attempt_at = NULL WHERE payload_json::text LIKE '%invalid_e2e_resource%' OR next_attempt_at > now() + interval '30 minutes'",
			);
			await db.end();
		}
	},
});

// Injects outbox faults instance-wide, so it must stay in the serial `instance` project.
/** Failure injection is scoped to tuple payloads mentioning this test's UUID. */
test("deletion transactions roll back with their outbox and committed cleanup replays", async ({
	api,
	faults,
	org,
	orgs,
	appBaseURL,
}) => {
	test.setTimeout(180_000);
	const { db, fault, latest } = faults;
	const makeUser = () =>
		signUpInvited({
			baseURL: appBaseURL,
			admin: api.asWellKnownAdmin(),
			organisation: org,
			role: "viewer",
			name: "Outbox failure injection",
			email: `outbox-${randomUUID()}@e2e.orcai.test`,
		});
	// Created before the invited sign-ups, so their responses carry a zedToken
	// at least as fresh as this organisation's grants.
	const doomed = await orgs.create("Outbox deletion");
	const member = await makeUser();
	const account = await makeUser();
	const admin = api.asWellKnownAdmin();
	const removeMember = () =>
		api.as("admin").organizationMember.delete({
			organizationId: org.id,
			refs: [
				{
					userId: userIdSchema.parse(member.userId),
				},
			],
		});
	const deleteAccount = () =>
		admin.user.delete({
			userIds: [
				userIdSchema.parse(account.userId),
			],
		});
	const deleteOrg = () =>
		admin.organization.delete({
			refs: [
				{
					id: doomed.id,
				},
			],
		});
	for (const [target, mutate, table, column] of [
		[
			member.userId,
			removeMember,
			"member",
			"user_id",
		],
		[
			account.userId,
			deleteAccount,
			'"user"',
			"id",
		],
		[
			doomed.id,
			deleteOrg,
			"organization",
			"id",
		],
	] as const) {
		const before = (await latest(target)).id;
		await fault(target, "rollback");
		await expect(mutate()).rejects.toThrow();
		expect(
			(
				await db.query(
					`SELECT count(*)::int AS count FROM ${table} WHERE ${column} = $1`,
					[
						target,
					],
				)
			).rows[0].count,
		).toBeGreaterThan(0);
		expect((await latest(target)).id).toBe(before);
	}
	await fault(member.userId, "delay");
	await removeMember();
	const delayed = await latest(member.userId);
	expect(delayed.status).toBe("pending");
	expect(
		(
			await db.query(
				"SELECT * FROM member WHERE user_id = $1 AND organization_id = $2",
				[
					member.userId,
					org.id,
				],
			)
		).rowCount,
	).toBe(0);
	await db.query(
		"UPDATE authz_outbox SET next_attempt_at = NULL WHERE id = $1",
		[
			delayed.id,
		],
	);
	await expect
		.poll(async () => (await latest(member.userId)).status, {
			timeout: 30_000,
		})
		.toBe("processed");

	// A failed sign-up acceptance keeps its account and invitation recoverable.
	const email = `signup-rollback-${randomUUID()}@e2e.orcai.test`;
	const invitation = (
		await admin.organizationInvitation.create({
			organizationId: doomed.id,
			role: "manager",
			expiresAt: new Date(Date.now() + 86400000),
			items: [
				{
					email,
				},
			],
		})
	).data[0];
	await fault(doomed.id, "rollback");
	const signup = await attemptSignUp(appBaseURL, {
		name: "Recoverable signup",
		email,
		password: USER_PASSWORD,
		invitationId: invitation.id,
	});
	expect(signup.ok).toBe(false);
	const survivor = await signIn(appBaseURL, {
		email,
		password: USER_PASSWORD,
	});
	const survivorClient = createApiClient(appBaseURL, survivor.cookieHeader);
	const status = async () =>
		(
			await db.query("SELECT status FROM invitation WHERE id = $1", [
				invitation.id,
			])
		).rows[0].status;
	expect(await status()).toBe("pending");
	expect(
		(
			await db.query("SELECT * FROM member WHERE user_id = $1", [
				survivor.userId,
			])
		).rowCount,
	).toBe(0);
	await expect(
		survivorClient.organizationInvitation.respond({
			id: invitation.id,
			response: "accept",
		}),
	).rejects.toThrow();
	expect(await status()).toBe("pending");
	// Membership can be added independently while an invitation is pending.
	await fault("none", "delay");
	const asViewer = (
		await api.as("admin", doomed).organizationInvitation.create({
			organizationId: doomed.id,
			role: "viewer",
			expiresAt: new Date(Date.now() + 86400000),
			items: [
				{
					email,
				},
			],
		})
	).data[0];
	await survivorClient.organizationInvitation.respond({
		id: asViewer.id,
		response: "accept",
	});
	await fault(survivor.userId, "delay");
	await survivorClient.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(await status()).toBe("accepted");
	const acceptance = await latest(survivor.userId);
	expect(acceptance.status).toBe("pending");
	expect(acceptance.payload_json.mutations[0].relation).toBe("viewer");
	expect(
		(
			await db.query("SELECT role FROM member WHERE user_id = $1", [
				survivor.userId,
			])
		).rows[0].role,
	).toBe("viewer");
	await db.query(
		"UPDATE authz_outbox SET next_attempt_at = NULL WHERE id = $1",
		[
			acceptance.id,
		],
	);
	await expect
		.poll(async () => (await latest(survivor.userId)).status, {
			timeout: 30_000,
		})
		.toBe("processed");
	await fault("none", "delay");
	await api.as("admin", doomed).organizationMember.delete({
		organizationId: doomed.id,
		refs: [
			{
				userId: userIdSchema.parse(survivor.userId),
			},
		],
	});
	await expect(
		survivorClient.organizationInvitation.respond({
			id: invitation.id,
			response: "accept",
		}),
	).rejects.toThrow();
	expect(
		(
			await db.query("SELECT * FROM member WHERE user_id = $1", [
				survivor.userId,
			])
		).rowCount,
	).toBe(0);
	await fault(account.userId, "fail");
	await deleteAccount();
	const failed = await latest(account.userId);
	expect(failed.status).toBe("failed");
	const unrelated = await api.as("admin").group.create({
		name: `Outbox unblocked ${randomUUID()}`,
	});
	await expect
		.poll(async () => (await latest(unrelated.data.id)).status, {
			timeout: 30_000,
		})
		.toBe("processed");
	expect(
		(
			await db.query('SELECT * FROM "user" WHERE id = $1', [
				account.userId,
			])
		).rowCount,
	).toBe(0);
	await db.query(
		"UPDATE authz_outbox SET payload_json = payload_json->'original', next_attempt_at = NULL WHERE id = $1",
		[
			failed.id,
		],
	);
	await expect
		.poll(async () => (await latest(account.userId)).status, {
			timeout: 30_000,
		})
		.toBe("processed");
	await fault(doomed.id, "delay");
	await deleteOrg();
	expect((await latest(doomed.id)).status).toBe("pending");
	await db.query(
		"UPDATE authz_outbox SET next_attempt_at = NULL WHERE id = $1",
		[
			(await latest(doomed.id)).id,
		],
	);
	await expect
		.poll(async () => (await latest(doomed.id)).status, {
			timeout: 30_000,
		})
		.toBe("processed");
});
