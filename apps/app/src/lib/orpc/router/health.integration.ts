import { describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { coreDependenciesHealthy } from "@/lib/health/health";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

describe("instance health", () => {
	test(
		"reports the stack's dependencies to instance admins only",
		async () => {
			const procedures = await run(Procedures);
			const {
				organizationId,
				actors: [orgAdmin],
			} = await organizationWith([
				"admin",
			]);
			const admin = await instanceAdmin(organizationId);

			expect(
				await rejection(
					run(procedures.health.instance({}, await procedureOptions(orgAdmin))),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
			expect(
				await rejection(
					run(
						procedures.health.sendTestEmail(
							{},
							await procedureOptions(orgAdmin),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});

			const { data } = await run(
				procedures.health.instance({}, await procedureOptions(admin)),
			);
			expect(
				data.checks
					.filter((check) =>
						[
							"postgres",
							"spicedb",
							"qdrant",
							"s3",
							"valkey",
						].includes(check.id),
					)
					.map((check) => [
						check.id,
						check.status,
					]),
			).toEqual([
				[
					"postgres",
					"ok",
				],
				[
					"spicedb",
					"ok",
				],
				[
					"qdrant",
					"ok",
				],
				[
					"s3",
					"ok",
				],
				[
					"valkey",
					"ok",
				],
			]);
			expect(data.versions.migration?.name).toBeString();
			expect(data.mail?.testEmail).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"queues one test email per minute for the requesting admin's own address",
		async () => {
			const procedures = await run(Procedures);
			const { organizationId } = await organizationWith([
				"admin",
			]);
			const admin = await instanceAdmin(organizationId);
			const options = await procedureOptions(admin);

			// The cooldown window is the clock minute; stay inside one.
			const intoMinute = Date.now() % 60_000;
			if (intoMinute > 55_000) await sleep(60_500 - intoMinute);
			const answers = await Promise.all(
				[
					1,
					2,
					3,
				].map(() => run(procedures.health.sendTestEmail({}, options))),
			);
			expect(answers.filter(({ queued }) => queued)).toHaveLength(1);

			const rows = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.select()
						.from(dbSchema.notificationOutbox)
						.where(
							and(
								eq(dbSchema.notificationOutbox.type, "instance.test-email"),
								eq(
									dbSchema.notificationOutbox.recipient,
									admin.user.email.toLowerCase(),
								),
							),
						);
				}),
			);
			expect(rows).toHaveLength(1);
			const { data } = await run(
				procedures.health.instance({}, await procedureOptions(admin)),
			);
			expect(data.mail?.testEmail).toMatchObject({
				status: "pending",
				deliveryChannel: null,
			});
		},
		TIMEOUT,
	);

	test("/api/health counts Postgres and SpiceDB as healthy on the stack", async () => {
		expect(await run(coreDependenciesHealthy)).toBe(true);
	});
});
