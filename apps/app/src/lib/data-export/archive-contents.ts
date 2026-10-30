import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { isS3NotFound, sendGetObjectCommand } from "@orcai/s3/server";
import { asc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { isEmptyReply } from "@/lib/ai/turn/reply-store";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { readImage, referencedImage } from "@/lib/images/images";
import type { ZipArchiveWriter } from "./zip-archive";

/** A stored conversation as the markdown a person reads. */
export type Transcript = (messages: ChatAgentUIMessage[]) => string;

const UNSAFE_NAME = /[\\/:*?"<>|\p{Cc}]+/gu;

/** A file name that unpacks on every system. */
const safeName = (value: string) =>
	value.replace(UNSAFE_NAME, "-").replace(/\s+/g, " ").trim().slice(0, 100);

const json = (value: unknown) => JSON.stringify(value, null, 2);

const chatEntryName = (chat: { id: string; title: string | null }) =>
	`chats/${safeName(chat.title ?? "") || "chat"} (${chat.id.slice(0, 8)})`;

const assetFileName = (asset: { title: string; fileType: string }) => {
	const name = safeName(asset.title) || "file";
	return name.toLowerCase().endsWith(`.${asset.fileType}`)
		? name
		: `${name}.${asset.fileType}`;
};

const AVATAR_ENTRY = "profile/avatar.webp";

/** The profile picture's bytes; answers the entry name, or null when the object is gone. */
const writeAvatar = (path: string, writer: ZipArchiveWriter) =>
	Effect.gen(function* () {
		const image = yield* referencedImage(path);
		const object = image ? yield* readImage(image.key) : undefined;
		if (!object) {
			yield* Effect.logWarning({
				operation: "data-export.avatar-missing",
			});
			return null;
		}
		yield* writer.addFile(AVATAR_ENTRY, object.body.transformToWebStream());
		return AVATAR_ENTRY;
	});

const writeAccount = (userId: UserId, writer: ZipArchiveWriter) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [user] = yield* db
			.select({
				id: dbSchema.user.id,
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				emailVerified: dbSchema.user.emailVerified,
				image: dbSchema.user.image,
				locale: dbSchema.user.locale,
				preferences: dbSchema.user.preferences,
				createdAt: dbSchema.user.createdAt,
				updatedAt: dbSchema.user.updatedAt,
			})
			.from(dbSchema.user)
			.where(eq(dbSchema.user.id, userId));
		const memberships = yield* db
			.select({
				organizationId: dbSchema.organization.id,
				organizationName: dbSchema.organization.name,
				role: dbSchema.member.role,
				joinedAt: dbSchema.member.createdAt,
			})
			.from(dbSchema.member)
			.innerJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, dbSchema.member.organizationId),
			)
			.where(eq(dbSchema.member.userId, userId))
			.orderBy(asc(dbSchema.member.createdAt), asc(dbSchema.member.id));
		const avatar = user?.image ? yield* writeAvatar(user.image, writer) : null;
		yield* writer.addText(
			"profile.json",
			json({
				...user,
				image: avatar,
				memberships,
			}),
		);

		const ratings = yield* db
			.select({
				chatId: dbSchema.chatMessage.chatId,
				messageId: dbSchema.chatMessageRating.messageId,
				rating: dbSchema.chatMessageRating.rating,
				createdAt: dbSchema.chatMessageRating.createdAt,
				updatedAt: dbSchema.chatMessageRating.updatedAt,
			})
			.from(dbSchema.chatMessageRating)
			.innerJoin(
				dbSchema.chatMessage,
				eq(dbSchema.chatMessage.id, dbSchema.chatMessageRating.messageId),
			)
			.where(eq(dbSchema.chatMessageRating.userId, userId))
			.orderBy(
				asc(dbSchema.chatMessageRating.createdAt),
				asc(dbSchema.chatMessageRating.messageId),
			);
		yield* writer.addText("ratings.json", json(ratings));

		const favourites = yield* db
			.select({
				botId: dbSchema.bot.id,
				botName: dbSchema.bot.name,
				createdAt: dbSchema.botFavourite.createdAt,
			})
			.from(dbSchema.botFavourite)
			.innerJoin(dbSchema.bot, eq(dbSchema.bot.id, dbSchema.botFavourite.botId))
			.where(eq(dbSchema.botFavourite.userId, userId))
			.orderBy(
				asc(dbSchema.botFavourite.createdAt),
				asc(dbSchema.botFavourite.botId),
			);
		yield* writer.addText("favourites.json", json(favourites));

		const bots = yield* db
			.select()
			.from(dbSchema.bot)
			.where(eq(dbSchema.bot.userId, userId))
			.orderBy(asc(dbSchema.bot.createdAt), asc(dbSchema.bot.id));
		yield* writer.addText("bots.json", json(bots));

		const blocks = yield* db
			.select()
			.from(dbSchema.block)
			.where(eq(dbSchema.block.userId, userId))
			.orderBy(asc(dbSchema.block.createdAt), asc(dbSchema.block.id));
		yield* writer.addText("blocks.json", json(blocks));
	});

/** Every chat as JSON with its messages and as a markdown transcript, one at a time. */
const writeChats = (
	userId: UserId,
	transcript: Transcript,
	writer: ZipArchiveWriter,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const chats = yield* db
			.select()
			.from(dbSchema.chat)
			.where(eq(dbSchema.chat.userId, userId))
			.orderBy(asc(dbSchema.chat.createdAt), asc(dbSchema.chat.id));

		yield* Effect.forEach(
			chats,
			(chat) =>
				Effect.gen(function* () {
					const rows = yield* db
						.select()
						.from(dbSchema.chatMessage)
						.where(eq(dbSchema.chatMessage.chatId, chat.id))
						.orderBy(asc(dbSchema.chatMessage.position));
					const messages = rows.filter((row) => !isEmptyReply(row));
					const name = chatEntryName(chat);

					yield* writer.addText(
						`${name}.json`,
						json({
							...chat,
							messages,
						}),
					);
					yield* writer.addText(
						`${name}.md`,
						transcript(
							messages.map(
								(message) =>
									({
										id: message.id,
										role: message.role,
										parts: message.parts,
										metadata: message.metadata,
										attachments: message.attachments,
									}) as ChatAgentUIMessage,
							),
						),
					);
				}),
			{
				discard: true,
			},
		);
	});

/** The asset list, and each asset's uploaded file as it was uploaded. */
const writeAssets = (userId: UserId, writer: ZipArchiveWriter) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const assets = yield* db
			.select()
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.userId, userId))
			.orderBy(asc(dbSchema.asset.createdAt), asc(dbSchema.asset.id));
		yield* writer.addText("assets.json", json(assets));

		yield* Effect.forEach(
			assets,
			(asset) =>
				Effect.gen(function* () {
					const object = yield* sendGetObjectCommand({
						bucket: asset.bucket,
						key: `${asset.prefix}/${asset.id}.${asset.fileType}`,
					});
					if (!object.Body) {
						return;
					}
					yield* writer.addFile(
						`files/${asset.id}/${assetFileName(asset)}`,
						object.Body.transformToWebStream(),
					);
				}).pipe(
					Effect.catchIf(
						(error) => error._tag === "S3Error" && isS3NotFound(error),
						() =>
							Effect.logWarning({
								operation: "data-export.asset-file-missing",
								assetId: asset.id,
							}),
					),
				),
			{
				discard: true,
			},
		);
	});

/** Writes everything the export holds for `userId` into the archive. */
export const writeDataExportContents =
	(params: { userId: UserId; transcript: Transcript }) =>
	(writer: ZipArchiveWriter) =>
		Effect.gen(function* () {
			yield* writeAccount(params.userId, writer);
			yield* writeChats(params.userId, params.transcript, writer);
			yield* writeAssets(params.userId, writer);
		});
