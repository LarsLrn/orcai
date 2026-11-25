import { describe, expect, test } from "bun:test";
import { eq, type SQL, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { dbSchema } from "../src/schema";
import { DB, DrizzleLive } from "../src/service";

class Rollback<A> extends Data.TaggedError("Rollback")<{
	readonly value: A;
}> {}

const readBack = (createdAt: Date | SQL) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const suffix = crypto.randomUUID();
		const [user] = yield* db
			.insert(dbSchema.user)
			.values({
				name: `Timestamps ${suffix}`,
				email: `timestamps-${suffix}@example.test`,
				emailVerified: true,
				createdAt,
				updatedAt: createdAt,
			})
			.returning();
		const [organization] = yield* db
			.insert(dbSchema.organization)
			.values({
				name: `Timestamps ${suffix}`,
				slug: `timestamps-${suffix}`,
				createdAt,
			})
			.returning();
		const [chat] = yield* db
			.insert(dbSchema.chat)
			.values({
				userId: user.id,
				organizationId: organization.id,
				createdAt,
			})
			.returning();
		const [selected] = yield* db
			.select({
				createdAt: dbSchema.chat.createdAt,
				stored: sql<string>`to_char(${dbSchema.chat.createdAt}, 'YYYY-MM-DD HH24:MI:SS.US')`,
			})
			.from(dbSchema.chat)
			.where(eq(dbSchema.chat.id, chat.id));
		const [joined] = yield* db
			.select({
				chat: dbSchema.chat,
				user: dbSchema.user,
			})
			.from(dbSchema.chat)
			.leftJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.chat.userId))
			.where(eq(dbSchema.chat.id, chat.id));
		const related = yield* db.query.chat.findFirst({
			where: {
				id: chat.id,
			},
			with: {
				user: true,
			},
		});
		return {
			stored: selected.stored,
			returning: user.createdAt,
			select: selected.createdAt,
			joinedRoot: joined.chat.createdAt,
			joinedNullable: joined.user?.createdAt,
			relationalRoot: related?.createdAt,
			relationalNested: related?.user?.createdAt,
		};
	});

const readBackRolledBack = (createdAt: Date | SQL) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.transaction(() =>
					Effect.flatMap(readBack(createdAt), (value) =>
						Effect.fail(
							new Rollback({
								value,
							}),
						),
					),
				)
				.pipe(
					Effect.catchTag("Rollback", ({ value }) => Effect.succeed(value)),
				);
		}).pipe(Effect.provide(DrizzleLive)),
	);

const expected = new Date("2026-10-28T10:11:12.345Z");

describe("timestamp columns", () => {
	test("keep milliseconds through every read path", async () => {
		expect(await readBackRolledBack(expected)).toEqual({
			stored: "2026-10-28 10:11:12.345000",
			returning: expected,
			select: expected,
			joinedRoot: expected,
			joinedNullable: expected,
			relationalRoot: expected,
			relationalNested: expected,
		});
	});

	test("truncate stored microseconds to milliseconds on every read path", async () => {
		expect(
			await readBackRolledBack(sql`'2026-10-28 10:11:12.345678'::timestamp`),
		).toEqual({
			stored: "2026-10-28 10:11:12.345678",
			returning: expected,
			select: expected,
			joinedRoot: expected,
			joinedNullable: expected,
			relationalRoot: expected,
			relationalNested: expected,
		});
	});
});
