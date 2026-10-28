import { describe, expect, test } from "bun:test";
import type { InstanceMail } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { checkInstance, type HealthSources, readinessResponse } from "./health";

const ok = Effect.succeed({
	ok: true,
});

const mail: InstanceMail = {
	pending: 0,
	dead: 0,
	lastError: null,
	lastDeliveryChannel: "smtp",
	testEmail: null,
};

const sources = (
	overrides: Partial<HealthSources<never>> = {},
): HealthSources<never> => ({
	probes: {
		postgres: Effect.succeed({
			ok: true,
			version: "17.11",
		}),
		spicedb: ok,
		qdrant: Effect.succeed({
			ok: true,
			version: "1.15.0",
		}),
		s3: ok,
		valkey: ok,
	},
	pgBoss: Effect.succeed({
		ok: true,
		processes: [
			{
				name: "workers",
				host: "worker-1",
				pid: 7,
				live: true,
				startedOn: new Date(),
				heartbeatOn: new Date(),
				lastWorkerErrorOn: null,
			},
		],
		queues: [],
	}),
	mail: Effect.succeed(mail),
	migration: Effect.succeed({
		name: "20261028115531_furry_valeria_richards",
		appliedAt: new Date("2026-10-28T12:00:00.000Z"),
	}),
	config: Effect.succeed({}),
	configWarnings: [],
	appVersion: "1.2.3",
	timeout: "50 millis",
	...overrides,
});

const run = (overrides?: Partial<HealthSources<never>>) =>
	Effect.runPromise(checkInstance(sources(overrides)));

const checkOf = async (id: string, overrides?: Partial<HealthSources<never>>) =>
	(await run(overrides)).checks.find((check) => check.id === id);

describe("checkInstance", () => {
	test("reports every check ok when all sources answer", async () => {
		const health = await run();
		expect(
			health.checks.map((check) => [
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
			[
				"workers",
				"ok",
			],
			[
				"mail",
				"ok",
			],
			[
				"config",
				"ok",
			],
		]);
	});

	test("fails a probe that does not answer in time", async () => {
		const health = await run({
			probes: {
				...sources().probes,
				qdrant: Effect.never,
			},
		});
		expect(health.checks.find((check) => check.id === "qdrant")).toMatchObject({
			status: "failing",
			severity: "required",
			reason: "DEPENDENCY_TIMEOUT",
		});
		expect(health.versions.qdrant).toBeNull();
	});

	test("fails a probe that errors or defects, with the cause as detail", async () => {
		const { checks } = await run({
			probes: {
				...sources().probes,
				spicedb: Effect.fail({
					cause: new Error("connect ECONNREFUSED"),
				}),
				valkey: Effect.die(new Error("boom")),
			},
		});
		expect(checks.find((check) => check.id === "spicedb")).toMatchObject({
			status: "failing",
			reason: "DEPENDENCY_UNREACHABLE",
			detail: "connect ECONNREFUSED",
		});
		expect(checks.find((check) => check.id === "valkey")).toMatchObject({
			status: "failing",
			severity: "recommended",
			detail: "boom",
		});
	});

	test("fails a reachable dependency that reports a problem", async () => {
		expect(
			await checkOf("s3", {
				probes: {
					...sources().probes,
					s3: Effect.succeed({
						ok: false,
						detail: "Bucket not reachable: uploads.",
					}),
				},
			}),
		).toMatchObject({
			status: "failing",
			reason: "DEPENDENCY_DEGRADED",
			detail: "Bucket not reachable: uploads.",
		});
	});

	test("fails workers when no live workers process is registered", async () => {
		expect(
			await checkOf("workers", {
				pgBoss: Effect.succeed({
					ok: true,
					processes: [
						{
							name: "app",
							host: "app-1",
							pid: 1,
							live: true,
							startedOn: new Date(),
							heartbeatOn: new Date(),
							lastWorkerErrorOn: null,
						},
					],
					queues: [],
				}),
			}),
		).toMatchObject({
			status: "failing",
			reason: "WORKERS_NOT_RUNNING",
		});
	});

	test("warns when mail only reached the worker log or died", async () => {
		expect(
			await checkOf("mail", {
				mail: Effect.succeed({
					...mail,
					lastDeliveryChannel: "log",
				}),
			}),
		).toMatchObject({
			status: "warning",
			reason: "MAIL_LOG_ONLY",
		});
		expect(
			await checkOf("mail", {
				mail: Effect.succeed({
					...mail,
					dead: 2,
					lastError: "550 rejected",
				}),
			}),
		).toMatchObject({
			status: "warning",
			reason: "MAIL_DEAD",
			params: {
				count: 2,
			},
			detail: "550 rejected",
		});
	});

	test("surfaces deployment warnings", async () => {
		expect(
			await checkOf("config", {
				configWarnings: [
					"WEB_URL is not an http(s) URL and is ignored.",
				],
			}),
		).toMatchObject({
			status: "warning",
			reason: "CONFIG_WARNINGS",
			detail: "WEB_URL is not an http(s) URL and is ignored.",
		});
	});

	test("reports versions and the last applied migration", async () => {
		expect((await run()).versions).toEqual({
			app: "1.2.3",
			postgres: "17.11",
			qdrant: "1.15.0",
			valkey: null,
			migration: {
				name: "20261028115531_furry_valeria_richards",
				appliedAt: new Date("2026-10-28T12:00:00.000Z"),
			},
		});
	});

	test("shows config values and only whether secrets are set", async () => {
		const health = await run({
			config: Effect.succeed({
				postgres: {
					host: "db",
					port: 5432,
					password: Redacted.make("hunter2"),
				},
				auth: {
					rateLimit: Option.none(),
				},
				umami: undefined,
			}),
		});
		expect(health.config).toEqual([
			{
				kind: "value",
				key: "postgres.host",
				value: "db",
			},
			{
				kind: "value",
				key: "postgres.port",
				value: "5432",
			},
			{
				kind: "secret",
				key: "postgres.password",
				set: true,
			},
			{
				kind: "unset",
				key: "auth.rateLimit",
			},
			{
				kind: "unset",
				key: "umami",
			},
		]);
		expect(JSON.stringify(health)).not.toContain("hunter2");
	});
});

describe("readinessResponse", () => {
	test("answers 200 without a body when ready", async () => {
		const response = await readinessResponse(async () => true);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});

	test("answers 503 when not ready or when the check itself fails", async () => {
		for (const ready of [
			async () => false,
			() => Promise.reject(new Error("runtime failed to start")),
		]) {
			const response = await readinessResponse(ready);
			expect(response.status).toBe(503);
			expect(await response.text()).toBe("");
		}
	});
});
