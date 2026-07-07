import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { NOTIFICATION_OUTBOX_JOB_NAME } from "@orcai/schema";
import { and, asc, eq, isNotNull, lte, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { EmailService } from "./email";
import { renderEmail } from "./render";
import { type EmailNotification, emailNotificationSchema } from "./schema";

export const NOTIFICATION_MAX_ATTEMPTS = 10;
const LEASE_MS = 5 * 60_000;
const OUTBOX_WAKE_SINGLETON_KEY = "notification-outbox-drain";
const OUTBOX_WAKE_SINGLETON_SECONDS = 5;

export const notificationOutboxValues = (
	notification: EmailNotification,
	deduplicationKey: string,
) => {
	const parsed = emailNotificationSchema.parse(notification);
	return {
		type: parsed.type,
		recipient: parsed.recipient.trim().toLowerCase(),
		payloadVersion: 1,
		payload: parsed as unknown as Record<string, unknown>,
		deduplicationKey,
	};
};

export const wakeNotificationWorker = Effect.gen(function* () {
	const { boss } = yield* PgBossService;
	yield* Effect.tryPromise({
		try: () =>
			boss.send(
				NOTIFICATION_OUTBOX_JOB_NAME,
				{},
				{
					singletonKey: OUTBOX_WAKE_SINGLETON_KEY,
					singletonSeconds: OUTBOX_WAKE_SINGLETON_SECONDS,
				},
			),
		catch: (cause) => cause,
	});
});

export const enqueueNotification = (
	notification: EmailNotification,
	deduplicationKey: string,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* db
			.insert(dbSchema.notificationOutbox)
			.values(notificationOutboxValues(notification, deduplicationKey))
			.onConflictDoNothing({
				target: dbSchema.notificationOutbox.deduplicationKey,
			});
		yield* wakeNotificationWorker.pipe(
			Effect.catch((cause) =>
				Effect.logWarning(`notification.wake.failed cause=${String(cause)}`),
			),
		);
	});

const retryDelay = (attempt: number) =>
	Math.min(24 * 60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1)) +
	Math.floor(Math.random() * 10_000);

const sanitizeError = (failure: unknown) =>
	String(failure)
		.replaceAll(/https?:\/\/\S+/gi, "[url]")
		.replaceAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
		.slice(0, 2000);

export const processNextNotification = () =>
	Effect.gen(function* () {
		const db = yield* DB;
		const email = yield* EmailService;
		const now = new Date();
		const row = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const [selected] = yield* tx
					.select()
					.from(dbSchema.notificationOutbox)
					.where(
						or(
							and(
								eq(dbSchema.notificationOutbox.status, "pending"),
								lte(dbSchema.notificationOutbox.nextAttemptAt, now),
							),
							and(
								eq(dbSchema.notificationOutbox.status, "processing"),
								isNotNull(dbSchema.notificationOutbox.leaseExpiresAt),
								lte(dbSchema.notificationOutbox.leaseExpiresAt, now),
							),
						),
					)
					.orderBy(asc(dbSchema.notificationOutbox.createdAt))
					.limit(1)
					.for("update", {
						skipLocked: true,
					});

				if (!selected) return undefined;
				yield* tx
					.update(dbSchema.notificationOutbox)
					.set({
						status: "processing",
						leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
						updatedAt: now,
					})
					.where(eq(dbSchema.notificationOutbox.id, selected.id));
				return selected;
			}),
		);

		if (!row) return false;
		const attempt = row.attempts + 1;
		const parsed = emailNotificationSchema.safeParse(row.payload);
		if (!parsed.success) {
			yield* db
				.update(dbSchema.notificationOutbox)
				.set({
					status: "dead",
					attempts: attempt,
					payload: {},
					leaseExpiresAt: null,
					lastError: "Notification payload validation failed",
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.notificationOutbox.id, row.id));
			yield* Effect.logWarning({
				operation: "notification.invalid-payload",
				notificationId: row.id,
				type: row.type,
			});
			return true;
		}

		const result = yield* Effect.exit(
			Effect.tryPromise({
				try: async () => {
					const notification = parsed.data;
					const rendered = await renderEmail(notification);
					return await Effect.runPromise(
						email.send({
							to: notification.recipient,
							...rendered,
						}),
					);
				},
				catch: (cause) => cause,
			}),
		);

		if (Exit.isSuccess(result)) {
			yield* db
				.update(dbSchema.notificationOutbox)
				.set({
					status: "sent",
					attempts: attempt,
					payload: {},
					leaseExpiresAt: null,
					lastError: null,
					providerMessageId: result.value.messageId,
					sentAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.notificationOutbox.id, row.id));
			yield* Effect.logInfo({
				operation: "notification.sent",
				notificationId: row.id,
				type: row.type,
				attempt,
				recipientDomain: row.recipient.split("@").at(-1),
			});
		} else {
			const failure = result.cause;
			const dead = attempt >= NOTIFICATION_MAX_ATTEMPTS;
			yield* db
				.update(dbSchema.notificationOutbox)
				.set({
					status: dead ? "dead" : "pending",
					attempts: attempt,
					payload: dead ? {} : row.payload,
					nextAttemptAt: new Date(Date.now() + retryDelay(attempt)),
					leaseExpiresAt: null,
					lastError: sanitizeError(failure),
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.notificationOutbox.id, row.id));
			yield* Effect.logWarning({
				operation: "notification.failed",
				notificationId: row.id,
				type: row.type,
				attempt,
				dead,
			});
		}

		return true;
	});

export const cleanupNotificationOutbox = Effect.gen(function* () {
	const db = yield* DB;
	const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
	yield* db
		.delete(dbSchema.notificationOutbox)
		.where(
			or(
				and(
					eq(dbSchema.notificationOutbox.status, "sent"),
					isNotNull(dbSchema.notificationOutbox.sentAt),
					lte(dbSchema.notificationOutbox.sentAt, cutoff),
				),
				and(
					eq(dbSchema.notificationOutbox.status, "dead"),
					lte(dbSchema.notificationOutbox.updatedAt, cutoff),
				),
			),
		);
});
