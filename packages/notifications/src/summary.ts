import { DB, dbSchema } from "@orcai/db";
import type { InstanceMail } from "@orcai/schema";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { EmailNotification } from "./schema";

const TEST_EMAIL_TYPE =
	"instance.test-email" satisfies EmailNotification["type"];

const outbox = dbSchema.notificationOutbox;

/** Outbox counts, the last error and channel, and the newest test email sent to `recipient`. */
export const outboxSummary = (recipient: string) =>
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
								eq(outbox.recipient, recipient.trim().toLowerCase()),
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
