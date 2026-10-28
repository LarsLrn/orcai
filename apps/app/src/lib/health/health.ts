import { AiConfigService, EncryptionKey } from "@orcai/ai";
import type { ProbeResult } from "@orcai/core";
import {
	DB,
	DbConfigLive,
	DbConfigService,
	dbSchema,
	findLatestMigration,
	probeDatabase,
} from "@orcai/db";
import { otlpEndpointHost } from "@orcai/observability";
import { type PgBossProbeResult, probePgBoss } from "@orcai/pg-boss";
import {
	probeQdrant,
	QdrantConfigLive,
	QdrantConfigService,
} from "@orcai/qdrant";
import { probeS3, S3ConfigLive, S3ConfigService } from "@orcai/s3/server";
import type {
	InstanceCheck,
	InstanceHealth,
	InstanceMail,
	InstanceVersions,
} from "@orcai/schema";
import {
	probeSpiceDb,
	SpiceDbConfigLive,
	SpiceDbConfigService,
} from "@orcai/spice-db";
import {
	probeValkey,
	ValkeyConfigLive,
	ValkeyConfigService,
} from "@orcai/valkey";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import * as Cause from "effect/Cause";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AppConfigService } from "@/lib/effect/services/config";
import { version } from "../../../package.json" with { type: "json" };
import { summarizeConfig } from "./config-summary";

const PROBE_TIMEOUT = "3 seconds";

const DEPENDENCIES = {
	postgres: "required",
	spicedb: "required",
	qdrant: "required",
	s3: "required",
	valkey: "recommended",
} as const;

type DependencyId = keyof typeof DEPENDENCIES;

type Outcome<A> =
	| {
			readonly _tag: "Done";
			readonly value: A;
	  }
	| {
			readonly _tag: "TimedOut";
	  }
	| {
			readonly _tag: "Failed";
			readonly detail: string;
	  };

/** Everything the health check reads, so tests can stand in for each part. */
export interface HealthSources<R> {
	readonly probes: {
		readonly [K in DependencyId]: Effect.Effect<ProbeResult, unknown, R>;
	};
	readonly pgBoss: Effect.Effect<PgBossProbeResult, unknown, R>;
	readonly mail: Effect.Effect<InstanceMail, unknown, R>;
	readonly migration: Effect.Effect<InstanceVersions["migration"], unknown, R>;
	readonly config: Effect.Effect<unknown, unknown, R>;
	readonly configWarnings: readonly string[];
	readonly appVersion: string;
	readonly timeout: Duration.Input;
}

const describeFailure = (cause: Cause.Cause<unknown>) => {
	const error = Cause.squash(cause);
	const inner =
		typeof error === "object" && error !== null && "cause" in error
			? error.cause
			: error;
	const text =
		inner instanceof Error && inner.message ? inner.message : String(inner);
	return text.slice(0, 500);
};

const settle = <A, R>(
	effect: Effect.Effect<A, unknown, R>,
	timeout: Duration.Input,
): Effect.Effect<Outcome<A>, never, R> =>
	effect.pipe(
		Effect.map(
			(value): Outcome<A> => ({
				_tag: "Done",
				value,
			}),
		),
		Effect.timeoutOrElse({
			duration: timeout,
			orElse: () =>
				Effect.succeed<Outcome<A>>({
					_tag: "TimedOut",
				}),
		}),
		Effect.catchCause((cause) =>
			Effect.succeed<Outcome<A>>({
				_tag: "Failed",
				detail: describeFailure(cause),
			}),
		),
	);

const doneValue = <A>(outcome: Outcome<A>) =>
	outcome._tag === "Done" ? outcome.value : undefined;

const unreachable = (
	outcome: Exclude<
		Outcome<unknown>,
		{
			_tag: "Done";
		}
	>,
	timeout: Duration.Input,
) =>
	outcome._tag === "TimedOut"
		? {
				status: "failing" as const,
				reason: "DEPENDENCY_TIMEOUT" as const,
				params: {
					timeout: String(timeout),
				},
			}
		: {
				status: "failing" as const,
				reason: "DEPENDENCY_UNREACHABLE" as const,
				detail: outcome.detail,
			};

const dependencyCheck = (
	id: DependencyId,
	outcome: Outcome<ProbeResult>,
	timeout: Duration.Input,
): InstanceCheck => {
	const severity = DEPENDENCIES[id];
	if (outcome._tag !== "Done") {
		return {
			id,
			severity,
			...unreachable(outcome, timeout),
		};
	}
	return outcome.value.ok
		? {
				id,
				severity,
				status: "ok",
				reason: "DEPENDENCY_REACHABLE",
			}
		: {
				id,
				severity,
				status: "failing",
				reason: "DEPENDENCY_DEGRADED",
				detail: outcome.value.detail,
			};
};

const workersCheck = (
	outcome: Outcome<PgBossProbeResult>,
	timeout: Duration.Input,
): InstanceCheck => {
	if (outcome._tag !== "Done") {
		return {
			id: "workers",
			severity: "required",
			...unreachable(outcome, timeout),
		};
	}
	const live = outcome.value.processes.filter(
		(process) => process.live && process.name === "workers",
	).length;
	return live > 0
		? {
				id: "workers",
				severity: "required",
				status: "ok",
				reason: "WORKERS_RUNNING",
				params: {
					count: live,
				},
			}
		: {
				id: "workers",
				severity: "required",
				status: "failing",
				reason: "WORKERS_NOT_RUNNING",
			};
};

const mailCheck = (
	outcome: Outcome<InstanceMail>,
	timeout: Duration.Input,
): InstanceCheck => {
	if (outcome._tag !== "Done") {
		return {
			id: "mail",
			severity: "recommended",
			...unreachable(outcome, timeout),
		};
	}
	const mail = outcome.value;
	if (mail.dead > 0) {
		return {
			id: "mail",
			severity: "recommended",
			status: "warning",
			reason: "MAIL_DEAD",
			params: {
				count: mail.dead,
			},
			detail: mail.lastError ?? undefined,
		};
	}
	switch (mail.lastDeliveryChannel) {
		case "smtp":
			return {
				id: "mail",
				severity: "recommended",
				status: "ok",
				reason: "MAIL_SMTP",
			};
		case "log":
			return {
				id: "mail",
				severity: "recommended",
				status: "warning",
				reason: "MAIL_LOG_ONLY",
			};
		case null:
			return {
				id: "mail",
				severity: "recommended",
				status: "warning",
				reason: "MAIL_NOT_SENT_YET",
			};
	}
};

const configCheck = (warnings: readonly string[]): InstanceCheck =>
	warnings.length === 0
		? {
				id: "config",
				severity: "recommended",
				status: "ok",
				reason: "CONFIG_OK",
			}
		: {
				id: "config",
				severity: "recommended",
				status: "warning",
				reason: "CONFIG_WARNINGS",
				params: {
					count: warnings.length,
				},
				detail: warnings.join("\n"),
			};

/** Runs every source concurrently, each within the timeout, and builds the report. */
export const checkInstance = <R>(
	sources: HealthSources<R>,
): Effect.Effect<InstanceHealth, never, R> =>
	Effect.gen(function* () {
		const { timeout } = sources;
		const ids = Object.keys(DEPENDENCIES) as DependencyId[];
		const [dependencies, pgBoss, mail, migration, config] = yield* Effect.all(
			[
				Effect.forEach(ids, (id) => settle(sources.probes[id], timeout), {
					concurrency: "unbounded",
				}),
				settle(sources.pgBoss, timeout),
				settle(sources.mail, timeout),
				settle(sources.migration, timeout),
				settle(sources.config, timeout),
			],
			{
				concurrency: "unbounded",
			},
		);
		const byId = Object.fromEntries(
			ids.map((id, index) => [
				id,
				dependencies[index],
			]),
		) as Record<DependencyId, Outcome<ProbeResult>>;
		const pgBossResult = doneValue(pgBoss);

		return {
			checks: [
				...ids.map((id) => dependencyCheck(id, byId[id], timeout)),
				workersCheck(pgBoss, timeout),
				mailCheck(mail, timeout),
				configCheck(sources.configWarnings),
			],
			versions: {
				app: sources.appVersion,
				postgres: doneValue(byId.postgres)?.version ?? null,
				qdrant: doneValue(byId.qdrant)?.version ?? null,
				valkey: doneValue(byId.valkey)?.version ?? null,
				migration: doneValue(migration) ?? null,
			},
			processes: [
				...(pgBossResult?.processes ?? []),
			],
			queues: [
				...(pgBossResult?.queues ?? []),
			],
			mail: doneValue(mail) ?? null,
			config: [
				...summarizeConfig(doneValue(config)),
			],
			checkedAt: new Date(),
		};
	});

const TEST_EMAIL_TYPE = "instance.test-email";

const outbox = dbSchema.notificationOutbox;

const mailSummary = (viewerEmail: string) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [[counts], [lastFailure], [lastSent], [testEmail]] =
			yield* Effect.all(
				[
					db
						.select({
							pending:
								sql<number>`count(*) filter (where ${outbox.status} in ('pending', 'processing'))`.mapWith(
									Number,
								),
							dead: sql<number>`count(*) filter (where ${outbox.status} = 'dead')`.mapWith(
								Number,
							),
						})
						.from(outbox),
					db
						.select({
							lastError: outbox.lastError,
						})
						.from(outbox)
						.where(
							and(
								isNotNull(outbox.lastError),
								inArray(outbox.status, [
									"pending",
									"dead",
								]),
							),
						)
						.orderBy(desc(outbox.updatedAt))
						.limit(1),
					db
						.select({
							deliveryChannel: outbox.deliveryChannel,
						})
						.from(outbox)
						.where(eq(outbox.status, "sent"))
						.orderBy(desc(outbox.sentAt))
						.limit(1),
					db
						.select({
							status: outbox.status,
							deliveryChannel: outbox.deliveryChannel,
							createdAt: outbox.createdAt,
							sentAt: outbox.sentAt,
						})
						.from(outbox)
						.where(
							and(
								eq(outbox.type, TEST_EMAIL_TYPE),
								eq(outbox.recipient, viewerEmail.trim().toLowerCase()),
							),
						)
						.orderBy(desc(outbox.createdAt))
						.limit(1),
				],
				{
					concurrency: "unbounded",
				},
			);

		return {
			pending: counts?.pending ?? 0,
			dead: counts?.dead ?? 0,
			lastError: lastFailure?.lastError ?? null,
			lastDeliveryChannel: lastSent?.deliveryChannel ?? null,
			testEmail: testEmail ?? null,
		} satisfies InstanceMail;
	});

const appProcessConfig = Effect.gen(function* () {
	const app = yield* AppConfigService;
	const { config: ai } = yield* AiConfigService;
	const { config: db } = yield* DbConfigService;
	const { config: spice } = yield* SpiceDbConfigService;
	const { config: qdrant } = yield* QdrantConfigService;
	const { config: valkey } = yield* ValkeyConfigService;
	const { config: s3 } = yield* S3ConfigService;
	return {
		auth: app.config.auth,
		app: {
			encryptionKey: yield* EncryptionKey,
		},
		docs: app.docs,
		umami: app.publicConfig.umami,
		postgres: db.postgres,
		spicedb: spice.spice,
		qdrant: {
			...qdrant.qdrant,
			embeddingDimensions: qdrant.embedding.dimensions,
		},
		valkey: valkey.valkey,
		s3,
		ai,
		otel: {
			endpointHost: otlpEndpointHost(),
		},
	};
}).pipe(
	Effect.provide(
		Layer.mergeAll(
			DbConfigLive,
			SpiceDbConfigLive,
			QdrantConfigLive,
			ValkeyConfigLive,
			S3ConfigLive,
		),
	),
);

/** The instance health report; the test email shown is the viewer's own. */
export const instanceHealth = (viewer: { readonly email: string }) =>
	Effect.gen(function* () {
		const { warnings } = yield* AppConfigService;
		const mail = mailSummary(viewer.email);
		return yield* checkInstance<
			| Effect.Services<typeof probeDatabase>
			| Effect.Services<typeof probeSpiceDb>
			| Effect.Services<typeof probeQdrant>
			| Effect.Services<typeof probeS3>
			| Effect.Services<typeof probeValkey>
			| Effect.Services<typeof probePgBoss>
			| Effect.Services<typeof mail>
			| Effect.Services<typeof appProcessConfig>
		>({
			probes: {
				postgres: probeDatabase,
				spicedb: probeSpiceDb,
				qdrant: probeQdrant,
				s3: probeS3,
				valkey: probeValkey,
			},
			pgBoss: probePgBoss,
			mail,
			migration: findLatestMigration,
			config: appProcessConfig,
			configWarnings: warnings,
			appVersion: version,
			timeout: PROBE_TIMEOUT,
		});
	});

/** Whether the dependencies no request can do without answer in time. */
export const coreDependenciesHealthy = Effect.gen(function* () {
	const [postgres, spicedb] = yield* Effect.all(
		[
			settle(probeDatabase, PROBE_TIMEOUT),
			settle(probeSpiceDb, PROBE_TIMEOUT),
		],
		{
			concurrency: "unbounded",
		},
	);
	return [
		postgres,
		spicedb,
	].every((outcome) => outcome._tag === "Done" && outcome.value.ok);
});

/** The `/api/health` answer: any failure, the runtime's included, reads as not ready. */
export const readinessResponse = async (ready: () => Promise<boolean>) =>
	new Response(null, {
		status: (await ready().catch(() => false)) ? 200 : 503,
		headers: {
			"Cache-Control": "no-store",
		},
	});
