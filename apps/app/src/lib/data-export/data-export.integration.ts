import { describe, expect, test } from "bun:test";
import {
	type AssetId,
	type BlockId,
	type BotId,
	buckets,
	type ChatId,
	type ChatMessageId,
	type MemberId,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	DATA_EXPORT_TTL_MS,
	dataExportKey,
	imagePath,
	parseImagePath,
} from "@orcai/s3";
import { sendGetObjectCommand, sendPutObjectCommand } from "@orcai/s3/server";
import type { DataExport } from "@orcai/schema";
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
	downloadableDataExport,
	failDataExports,
	runDataExport,
} from "./data-export";

const { run, organizationWith, procedureOptions } = authzIntegration();

const FILE_CONTENT = "Field notes, page one.";
const PICTURE_CONTENT = "picture bytes";

/** A chat with a question and an answer, a rating, a favourite bot, a block and two assets, one without its file. */
const seed = (userId: UserId, organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [bot] = yield* db
				.insert(dbSchema.bot)
				.values({
					name: "Export bot",
					description: "",
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
					type: "behaviour",
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
					organizationId,
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
			const picture = imagePath(
				{
					kind: "user",
					userId,
				},
				crypto.randomUUID(),
			);
			yield* sendPutObjectCommand({
				bucket: buckets.main.name,
				key: parseImagePath(picture)?.key ?? "",
				body: PICTURE_CONTENT,
				contentType: "image/webp",
			});
			yield* db
				.update(dbSchema.user)
				.set({
					image: picture,
				})
				.where(eq(dbSchema.user.id, userId));
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

const EARLY = new Date("2026-01-01T00:00:00Z");
const TIED = new Date("2026-01-02T00:00:00Z");
const LATE = new Date("2026-01-03T00:00:00Z");

/**
 * Rows in insert order: two that tie on creation time and are written in
 * reverse id order, an earlier one with the highest id and a later one with the
 * lowest, so neither insert order nor id alone gives the export order.
 */
const ORDERED = [
	{
		rank: 2,
		createdAt: TIED,
		role: "manager",
	},
	{
		rank: 1,
		createdAt: TIED,
		role: "admin",
	},
	{
		rank: 3,
		createdAt: EARLY,
		role: "viewer",
	},
	{
		rank: 0,
		createdAt: LATE,
		role: "member",
	},
] as const;

/** An id whose sort position is its rank, unique per call. */
const rankedId = <Id extends string>(rank: number) =>
	`${rank.toString(16)}${crypto.randomUUID().slice(1)}` as Id;

const ordered = <Row>(rows: Row[]) =>
	[
		2,
		1,
		0,
		3,
	].map((index) => rows[index] as Row);

/** Four rows of every exported list, ordered by creation time and then by id. */
const seedOrdered = (userId: UserId, organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const withIds = <Id extends string>() =>
				ORDERED.map((row, index) => ({
					...row,
					index,
					id: rankedId<Id>(row.rank),
				}));
			const members = withIds<MemberId>();
			yield* db.insert(dbSchema.member).values(
				members.map((row) => ({
					id: row.id,
					organizationId,
					userId,
					role: row.role,
					createdAt: row.createdAt,
				})),
			);
			const bots = withIds<BotId>();
			yield* db.insert(dbSchema.bot).values(
				bots.map((row) => ({
					id: row.id,
					name: `Bot ${row.index}`,
					description: "",
					userId,
					createdAt: row.createdAt,
				})),
			);
			yield* db.insert(dbSchema.botFavourite).values(
				bots.map((row) => ({
					userId,
					botId: row.id,
					createdAt: row.createdAt,
				})),
			);
			const blocks = withIds<BlockId>();
			yield* db.insert(dbSchema.block).values(
				blocks.map((row) => ({
					id: row.id,
					type: "behaviour" as const,
					name: `Block ${row.index}`,
					config: {},
					userId,
					createdAt: row.createdAt,
				})),
			);
			const chats = withIds<ChatId>();
			yield* db.insert(dbSchema.chat).values(
				chats.map((row) => ({
					id: row.id,
					title: `Chat ${row.index}`,
					userId,
					organizationId,
					createdAt: row.createdAt,
				})),
			);
			const messages = withIds<ChatMessageId>();
			yield* db.insert(dbSchema.chatMessage).values(
				messages.map((row) => ({
					id: row.id,
					chatId: chats[0]?.id as ChatId,
					role: "user" as const,
					parts: [],
					attachments: [],
					metadata: {},
					position: row.index,
				})),
			);
			yield* db.insert(dbSchema.chatMessageRating).values(
				messages.map((row) => ({
					messageId: row.id,
					userId,
					rating: "very_much" as const,
					createdAt: row.createdAt,
				})),
			);
			const assets = withIds<AssetId>();
			yield* db.insert(dbSchema.asset).values(
				assets.map((row) => ({
					id: row.id,
					bucket: buckets.main.name,
					prefix: `users/${userId}/asset/2026/10`,
					title: `Asset ${row.index}`,
					fileType: "txt" as const,
					size: 1,
					userId,
					createdAt: row.createdAt,
				})),
			);
			return {
				bots,
				blocks,
				chats,
				messages,
				assets,
			};
		}),
	);

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
			const seeded = await seed(userId, organizationId);

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
					"profile/avatar.webp",
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
			expect(profile.image).toBe("profile/avatar.webp");
			expect(archive["profile/avatar.webp"]).toBe(PICTURE_CONTENT);
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
			).toEqual(
				[
					seeded.notes.id,
					seeded.missing.id,
				].sort(),
			);

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
		"orders every list by creation time and then by id",
		async () => {
			const {
				actors: [owner],
				organizationId,
			} = await organizationWith([
				"member",
			]);
			const userId = owner.user.id;
			const seeded = await seedOrdered(userId, organizationId);

			const requested = await requestExport(owner);
			await run(runDataExport(requested.id, transcriptMarkdown));
			const archive = await archiveOf(userId, requested);

			const idsOf = (
				rows: {
					id: string;
				}[],
			) => ordered(rows).map((row) => row.id);
			const entryIds = (name: string, key: string) =>
				jsonEntry(archive, name).map((row: Record<string, string>) => row[key]);
			expect(
				jsonEntry(archive, "profile.json").memberships.map(
					(membership: { role: string }) => membership.role,
				),
			).toEqual([
				"viewer",
				"admin",
				"manager",
				"member",
				"member",
			]);
			expect(entryIds("ratings.json", "messageId")).toEqual(
				idsOf(seeded.messages),
			);
			expect(entryIds("favourites.json", "botId")).toEqual(idsOf(seeded.bots));
			expect(entryIds("bots.json", "id")).toEqual(idsOf(seeded.bots));
			expect(entryIds("blocks.json", "id")).toEqual(idsOf(seeded.blocks));
			expect(entryIds("assets.json", "id")).toEqual(idsOf(seeded.assets));
			expect(
				Object.keys(archive).filter((name) => /^chats\/.*\.json$/.test(name)),
			).toEqual(
				ordered(seeded.chats).map(
					(chat) => `chats/Chat ${chat.index} (${chat.id.slice(0, 8)}).json`,
				),
			);
		},
		TIMEOUT,
	);

	test(
		"reads a ready export past its expiry as expired, refuses its download and allows a new request",
		async () => {
			const {
				actors: [owner],
			} = await organizationWith([
				"member",
			]);
			const requested = await requestExport(owner);
			await run(runDataExport(requested.id, transcriptMarkdown));
			expect((await latestExport(owner))?.status).toBe("ready");

			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.dataExport)
						.set({
							expiresAt: new Date(Date.now() - 1_000),
						})
						.where(eq(dbSchema.dataExport.id, requested.id));
				}),
			);

			expect((await latestExport(owner))?.status).toBe("expired");
			expect(
				await run(downloadableDataExport(owner.user.id, requested.id)),
			).toBeUndefined();
			expect((await requestExport(owner)).status).toBe("pending");
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

	test(
		"exports the chats of an organisation the user left, without any membership",
		async () => {
			const {
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: chat } = await run(
				procedures.chat.create(
					{
						title: "Before leaving",
					},
					await procedureOptions(member, zedToken),
				),
			);
			await run(
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await procedureOptions(admin, zedToken),
				),
			);
			const unattached: Actor = {
				...member,
				session: {
					...member.session,
					activeOrganizationId: null,
				},
			};

			const requested = await requestExport(unattached);
			await run(runDataExport(requested.id, transcriptMarkdown));

			const archive = await archiveOf(member.user.id, requested);
			expect(jsonEntry(archive, "profile.json").memberships).toEqual([]);
			expect(
				Object.keys(archive).filter((name) => name.startsWith("chats/")),
			).toEqual([
				`chats/Before leaving (${chat.id.slice(0, 8)}).json`,
				`chats/Before leaving (${chat.id.slice(0, 8)}).md`,
			]);
		},
		TIMEOUT,
	);
});
