import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { rejection } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { coreDependenciesHealthy } from "@/lib/health/health";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	appIntegration();

/** The real clock stopped at `at.ms`, which the test moves. */
const stoppedClock = (at: { ms: number }) =>
	Effect.gen(function* () {
		const real = yield* Clock.Clock;
		const nanos = () => BigInt(at.ms) * 1_000_000n;
		return {
			currentTimeMillisUnsafe: () => at.ms,
			currentTimeMillis: Effect.sync(() => at.ms),
			currentTimeNanosUnsafe: nanos,
			currentTimeNanos: Effect.sync(nanos),
			monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
			monotonicTimeNanos: real.monotonicTimeNanos,
			sleep: (duration) => real.sleep(duration),
		} satisfies Clock.Clock;
	});

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
			const at = {
				ms: Date.now(),
			};
			const clock = await run(stoppedClock(at));
			const send = () =>
				run(
					procedures.health.sendTestEmail(
						{},
						{
							context: {
								...options.context,
								"effect/context": Context.add(
									options.context["effect/context"],
									Clock.Clock,
									clock,
								),
							},
						},
					),
				);

			const answers = await Promise.all(
				[
					1,
					2,
					3,
				].map(send),
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

			at.ms += 60_000;
			expect(await send()).toEqual({
				queued: true,
			});
		},
		TIMEOUT,
	);

	test("/api/health counts Postgres and SpiceDB as healthy on the stack", async () => {
		expect(await run(coreDependenciesHealthy)).toBe(true);
	});
});
