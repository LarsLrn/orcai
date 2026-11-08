import { PgClient } from "@effect/sql-pg";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { NOTIFICATION_OUTBOX_JOB_NAME } from "@orcai/schema";
import { and, asc, eq, isNotNull, lte, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { EmailService } from "./email";
import { EmailError } from "./errors";
import { renderEmail } from "./render";
import { type EmailNotification, emailNotificationSchema } from "./schema";

const NOTIFICATION_MAX_ATTEMPTS = 10;
const LEASE_MS = 5 * 60_000;
/** Rendering and sending give up before the lease lets another worker claim the row. */
const DELIVERY_DEADLINE_MS = LEASE_MS - 60_000;
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
		payload: parsed,
		deduplicationKey,
	};
};

/**
 * Debounced, not throttled: a wake after a drain started still gets one in
 * the next slot. A failed wake is logged, the drain schedule picks the rows up.
 */
export const wakeNotificationWorker = Effect.gen(function* () {
	const { boss } = yield* PgBossService;
	yield* Effect.tryPromise(() =>
		boss.sendDebounced(
			NOTIFICATION_OUTBOX_JOB_NAME,
			{},
			null,
			OUTBOX_WAKE_SINGLETON_SECONDS,
			OUTBOX_WAKE_SINGLETON_KEY,
		),
	).pipe(
		Effect.catch((cause) =>
			Effect.logWarning("notification.wake.failed", cause),
		),
	);
});

/** The wakes registered in one transaction share a token, so its commit wakes once. */
const pendingWakes = new WeakMap<
	object,
	{
		woken: boolean;
	}
>();

const wakeAfterCommit = Effect.gen(function* () {
	const sql = yield* PgClient.PgClient;
	const transaction = yield* Effect.serviceOption(sql.transactionService);
	if (Option.isNone(transaction)) return yield* wakeNotificationWorker;
	const [connection] = transaction.value;
	const token = pendingWakes.get(connection) ?? {
		woken: false,
	};
	pendingWakes.set(connection, token);
	yield* sql.afterCommit(
		Effect.suspend(() => {
			if (token.woken) return Effect.void;
			token.woken = true;
			pendingWakes.delete(connection);
			return wakeNotificationWorker;
		}),
	);
});

export type QueuedNotification = Readonly<{
	notification: EmailNotification;
	deduplicationKey: string;
}>;

/**
 * Queues the notifications in the current transaction, skipping any whose
 * deduplication key is already queued, and wakes the worker once the
 * transaction commits. Returns the deduplication keys it queued.
 */
export const enqueueNotifications = (
	notifications: ReadonlyArray<QueuedNotification>,
) =>
	Effect.gen(function* () {
		if (notifications.length === 0) return [];
		const db = yield* DB;
		const inserted = yield* db
			.insert(dbSchema.notificationOutbox)
			.values(
				notifications.map(({ notification, deduplicationKey }) =>
					notificationOutboxValues(notification, deduplicationKey),
				),
			)
			.onConflictDoNothing({
				target: dbSchema.notificationOutbox.deduplicationKey,
			})
			.returning({
				deduplicationKey: dbSchema.notificationOutbox.deduplicationKey,
			});
		if (inserted.length > 0) yield* wakeAfterCommit;
		return inserted.map((row) => row.deduplicationKey);
	});

/** False when a notification with the same deduplication key is already queued. */
export const enqueueNotification = (
	notification: EmailNotification,
	deduplicationKey: string,
) =>
	enqueueNotifications([
		{
			notification,
			deduplicationKey,
		},
	]).pipe(Effect.map((queued) => queued.length > 0));

const retryDelay = (attempt: number) =>
	Math.min(24 * 60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1)) +
	Math.floor(Math.random() * 10_000);

const sanitizeError = (failure: unknown) =>
	String(failure)
		.replaceAll(/https?:\/\/\S+/gi, "[url]")
		.replaceAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
		.slice(0, 2000);

type Settlement = Partial<typeof dbSchema.notificationOutbox.$inferInsert>;

/**
 * Claims the oldest due row, delivers it and records the result. Each claim
 * consumes an attempt, and only the claim still holding the row settles it,
 * so a sender whose lease expired cannot undo its replacement's result.
 */
export const processNextNotification = () =>
	Effect.gen(function* () {
		const db = yield* DB;
		const email = yield* EmailService;
		const now = new Date();
		const claimed = yield* db.transaction((tx) =>
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
				const exhausted = selected.attempts >= NOTIFICATION_MAX_ATTEMPTS;
				yield* tx
					.update(dbSchema.notificationOutbox)
					.set(
						exhausted
							? {
									status: "dead",
									payload: {},
									leaseExpiresAt: null,
									lastError: "Notification attempts exhausted",
									updatedAt: now,
								}
							: {
									status: "processing",
									attempts: selected.attempts + 1,
									leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
									updatedAt: now,
								},
					)
					.where(eq(dbSchema.notificationOutbox.id, selected.id));
				return {
					row: selected,
					attempt: selected.attempts + 1,
					exhausted,
				};
			}),
		);

		if (!claimed) return false;
		const { row, attempt } = claimed;
		if (claimed.exhausted) {
			yield* Effect.logWarning({
				operation: "notification.exhausted",
				notificationId: row.id,
				type: row.type,
			});
			return true;
		}

		const settle = (values: Settlement) =>
			db
				.update(dbSchema.notificationOutbox)
				.set({
					...values,
					leaseExpiresAt: null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(dbSchema.notificationOutbox.id, row.id),
						eq(dbSchema.notificationOutbox.status, "processing"),
						eq(dbSchema.notificationOutbox.attempts, attempt),
					),
				)
				.returning({
					id: dbSchema.notificationOutbox.id,
				})
				.pipe(
					Effect.tap((settled) =>
						settled.length > 0
							? Effect.void
							: Effect.logWarning({
									operation: "notification.lease-lost",
									notificationId: row.id,
									type: row.type,
									attempt,
								}),
					),
				);

		const parsed = emailNotificationSchema.safeParse(row.payload);
		if (!parsed.success) {
			yield* settle({
				status: "dead",
				payload: {},
				lastError: "Notification payload validation failed",
			});
			yield* Effect.logWarning({
				operation: "notification.invalid-payload",
				notificationId: row.id,
				type: row.type,
			});
			return true;
		}

		const notification = parsed.data;
		const result = yield* Effect.exit(
			Effect.tryPromise({
				try: () => renderEmail(notification),
				catch: (cause) =>
					new EmailError({
						operation: "render",
						cause,
					}),
			}).pipe(
				Effect.flatMap((rendered) =>
					email.send({
						to: notification.recipient,
						...rendered,
					}),
				),
				Effect.timeout(DELIVERY_DEADLINE_MS),
			),
		);

		if (Exit.isSuccess(result)) {
			yield* settle({
				status: "sent",
				payload: {},
				lastError: null,
				providerMessageId: result.value.messageId,
				deliveryChannel: result.value.channel,
				sentAt: new Date(),
			});
			yield* Effect.logInfo({
				operation: "notification.sent",
				notificationId: row.id,
				type: row.type,
				attempt,
				recipientDomain: row.recipient.split("@").at(-1),
			});
		} else {
			const dead = attempt >= NOTIFICATION_MAX_ATTEMPTS;
			yield* settle({
				status: dead ? "dead" : "pending",
				...(dead
					? {
							payload: {},
						}
					: {}),
				nextAttemptAt: new Date(Date.now() + retryDelay(attempt)),
				lastError: sanitizeError(result.cause),
			});
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
