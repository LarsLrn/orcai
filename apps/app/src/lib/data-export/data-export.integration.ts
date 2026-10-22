import { beforeAll, describe, expect, test } from "bun:test";
import { buckets, type ChatMessageId, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { dataExportKey } from "@orcai/s3";
import { sendGetObjectCommand, sendPutObjectCommand } from "@orcai/s3/server";
import { DATA_EXPORT_JOB_NAME, type DataExport } from "@orcai/schema";
import {
	TextWriter,
	Uint8ArrayReader,
	ZipReader,
} from "@zip.js/zip.js/index-native.js";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	DATA_EXPORT_TTL_MS,
	downloadableDataExport,
	failDataExports,
	runDataExport,
} from "./data-export";

const { run, organizationWith, procedureOptions } = authzIntegration();

// Workers create the queues at boot; the tier runs none.
beforeAll(() =>
	run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			yield* Effect.promise(() => boss.createQueue(DATA_EXPORT_JOB_NAME));
		}),
	),
);

const FILE_CONTENT = "Field notes, page one.";

/** A chat with a question and an answer, a rating, a favourite bot, a block and two assets, one without its file. */
const seed = (userId: UserId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [bot] = yield* db
				.insert(dbSchema.bot)
				.values({
					name: "Export bot",
					description: "",
					contentHtml: "",
					userId,
				})
				.returning();
			yield* db.insert(dbSchema.botFavourite).values({
				userId,
				botId: bot.id,
			});
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "template",
					name: "Export block",
					config: {},
					userId,
				})
				.returning();
			const [chat] = yield* db
				.insert(dbSchema.chat)
				.values({
					title: "Soil: samples?",
					userId,
				})
				.returning();
			const [, answer] = yield* db
				.insert(dbSchema.chatMessage)
				.values([
					{
						id: crypto.randomUUID() as ChatMessageId,
						chatId: chat.id,
						role: "user",
						parts: [
							{
								type: "text",
								text: "How deep do I sample?",
							},
						],
						attachments: [],
						metadata: {},
						position: 0,
					},
					{
						id: crypto.randomUUID() as ChatMessageId,
						chatId: chat.id,
						role: "assistant",
						parts: [
							{
								type: "text",
								text: "Thirty centimetres.",
							},
						],
						attachments: [],
						metadata: {},
						position: 1,
					},
					{
						id: crypto.randomUUID() as ChatMessageId,
						chatId: chat.id,
						role: "assistant",
						parts: [],
						attachments: [],
						metadata: {},
						position: 2,
					},
				])
				.returning();
			yield* db.insert(dbSchema.chatMessageRating).values({
				messageId: answer.id,
				userId,
				rating: "very_much",
			});
			const [notes, missing] = yield* db
				.insert(dbSchema.asset)
				.values([
					{
						bucket: buckets.main.name,
						prefix: `users/${userId}/asset/2026/10`,
						title: "notes.txt",
						fileType: "txt",
						size: FILE_CONTENT.length,
						userId,
					},
					{
						bucket: buckets.main.name,
						prefix: `users/${userId}/asset/2026/10`,
						title: "Lost",
						fileType: "pdf",
						size: 1,
						userId,
					},
				])
				.returning();
			yield* sendPutObjectCommand({
				bucket: notes.bucket,
				key: `${notes.prefix}/${notes.id}.txt`,
				body: FILE_CONTENT,
				contentType: "text/plain",
			});
			return {
				bot,
				block,
				chat,
				answer,
				notes,
				missing,
			};
		}),
	);

const procedures = await run(Procedures);

const requestExport = async (actor: Actor) =>
	(await run(procedures.dataExport.request({}, await procedureOptions(actor))))
		.data;

const latestExport = async (actor: Actor) =>
	(await run(procedures.dataExport.latest({}, await procedureOptions(actor))))
		.data;

const archiveOf = (userId: UserId, dataExport: DataExport) =>
	run(
		Effect.gen(function* () {
			const object = yield* sendGetObjectCommand({
				bucket: buckets.main.name,
				key: dataExportKey({
					userId,
					dataExportId: dataExport.id,
				}),
			});
			return yield* Effect.promise(async () => {
				const bytes = await object.Body?.transformToByteArray();
				const reader = new ZipReader(
					new Uint8ArrayReader(bytes ?? new Uint8Array()),
				);
				const entries = await reader.getEntries();
				const archive: Record<string, string> = {};
				for (const entry of entries) {
					if (!entry.directory) {
						archive[entry.filename] = await entry.getData(new TextWriter());
					}
				}
				await reader.close();
				return archive;
			});
		}),
	);

const jsonEntry = (archive: Record<string, string>, name: string) =>
	JSON.parse(archive[name] ?? "null");

describe("data export", () => {
	test(
		"builds an archive of the user's data and emails them when it is ready",
		async () => {
			const {
				actors: [owner, other],
				organizationId,
			} = await organizationWith([
				"member",
				"member",
			]);
			const userId = owner.user.id;
			const seeded = await seed(userId);

			const requested = await requestExport(owner);
			expect(requested.status).toBe("pending");
			await run(runDataExport(requested.id, transcriptMarkdown));

			const ready = await latestExport(owner);
			expect(ready?.status).toBe("ready");
			expect(ready?.size).toBeGreaterThan(0);
			expect(
				(ready?.expiresAt?.getTime() ?? 0) -
					(ready?.completedAt?.getTime() ?? 0),
			).toBe(DATA_EXPORT_TTL_MS);

			const archive = await archiveOf(userId, requested);
			const chatName = `chats/Soil- samples- (${seeded.chat.id.slice(0, 8)})`;
			expect(Object.keys(archive).sort()).toEqual(
				[
					"profile.json",
					"ratings.json",
					"favourites.json",
					"bots.json",
					"blocks.json",
					`${chatName}.json`,
					`${chatName}.md`,
					"assets.json",
					`files/${seeded.notes.id}/notes.txt`,
				].sort(),
			);

			const profile = jsonEntry(archive, "profile.json");
			expect(profile.email).toBe(owner.user.email);
			expect(profile.memberships).toEqual([
				expect.objectContaining({
					organizationId,
					role: "member",
				}),
			]);
			expect(jsonEntry(archive, "ratings.json")).toEqual([
				expect.objectContaining({
					chatId: seeded.chat.id,
					messageId: seeded.answer.id,
					rating: "very_much",
				}),
			]);
			expect(jsonEntry(archive, "favourites.json")).toEqual([
				expect.objectContaining({
					botId: seeded.bot.id,
					botName: "Export bot",
				}),
			]);
			expect(
				jsonEntry(archive, "bots.json").map((bot: { id: string }) => bot.id),
			).toEqual([
				seeded.bot.id,
			]);
			expect(
				jsonEntry(archive, "blocks.json").map(
					(block: { id: string }) => block.id,
				),
			).toEqual([
				seeded.block.id,
			]);
			expect(
				jsonEntry(archive, "assets.json").map(
					(asset: { id: string }) => asset.id,
				),
			).toEqual([
				seeded.notes.id,
				seeded.missing.id,
			]);

			const chat = jsonEntry(archive, `${chatName}.json`);
			expect(chat.title).toBe("Soil: samples?");
			expect(
				chat.messages.map((message: { role: string }) => message.role),
			).toEqual([
				"user",
				"assistant",
			]);
			expect(archive[`${chatName}.md`]).toBe(
				"**User:**\n\nHow deep do I sample?\n\n**Assistant:**\n\nThirty centimetres.",
			);
			expect(archive[`files/${seeded.notes.id}/notes.txt`]).toBe(FILE_CONTENT);

			const [email] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select()
						.from(dbSchema.notificationOutbox)
						.where(
							eq(
								dbSchema.notificationOutbox.deduplicationKey,
								`data-export.ready:${requested.id}`,
							),
						);
				}),
			);
			expect(email?.type).toBe("data-export.ready");
			expect(email?.recipient).toBe(owner.user.email.toLowerCase());
			expect(email?.payload).toMatchObject({
				accountUrl: expect.stringMatching(/\/app\/account\/data$/),
				expiresAt: ready?.expiresAt?.toISOString(),
			});

			expect(
				await run(downloadableDataExport(userId, requested.id)),
			).toMatchObject({
				key: dataExportKey({
					userId,
					dataExportId: requested.id,
				}),
			});
			expect(
				await run(downloadableDataExport(other.user.id, requested.id)),
			).toBeUndefined();
		},
		TIMEOUT,
	);

	test(
		"runs one export per user at a time",
		async () => {
			const {
				actors: [owner],
			} = await organizationWith([
				"member",
			]);
			const first = await requestExport(owner);

			const second = await run(
				procedures.dataExport
					.request({}, await procedureOptions(owner))
					.pipe(Effect.flip),
			);
			expect(second).toMatchObject({
				_tag: "ConflictError",
				reason: "DATA_EXPORT_IN_PROGRESS",
			});

			await run(
				failDataExports([
					first.id,
				]),
			);
			expect((await latestExport(owner))?.status).toBe("failed");
			await run(runDataExport(first.id, transcriptMarkdown));
			expect((await latestExport(owner))?.status).toBe("failed");

			const retried = await requestExport(owner);
			expect(retried.id).not.toBe(first.id);
			expect(retried.status).toBe("pending");
		},
		TIMEOUT,
	);
});
