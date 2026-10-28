import type { BotId, OrganizationId, UserId } from "@orcai/core";
import type { ChatReadOnlyReason } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

type ChatState = {
	organizationId: OrganizationId;
	botId: BotId | null;
	botDeletedAt: Date | null;
};

/**
 * Null when the requester can continue the chat. Only a deleted bot is
 * permanent; the organisation and the bot's access are read at request time,
 * so regaining them unlocks the chat.
 */
export const chatReadOnlyReason = (
	chat: ChatState,
	{
		activeOrganizationId,
		isMember,
		botUsable,
	}: {
		activeOrganizationId: OrganizationId | undefined;
		/** Whether the requester is a member of the chat's organisation. */
		isMember: boolean;
		/** Whether the requester may use the chat's bot. */
		botUsable: boolean;
	},
): ChatReadOnlyReason | null => {
	if (chat.botDeletedAt) return "bot-deleted";
	if (chat.organizationId !== activeOrganizationId) {
		return isMember ? "other-organization" : "not-member";
	}
	if (chat.botId && !botUsable) return "bot-unavailable";
	return null;
};

/** Whether the user may use the chat's bot now; true for a chat without one. */
export const chatBotUsable = (
	chat: Pick<ChatState, "botId">,
	viewer: {
		userId: UserId;
		zedToken: string | undefined;
	},
) =>
	chat.botId
		? permittedEntityIds({
				entityIds: [
					chat.botId,
				],
				entityType: "bot",
				permission: "use",
				...viewer,
			}).pipe(Effect.map((usable) => usable.size > 0))
		: Effect.succeed(true);

/**
 * Fails unless the chat can take turns, edits, branches and attachments in
 * the active organisation, whose membership the caller has verified.
 * `botUsable` runs only for a chat whose bot decides.
 */
export const requireWritableChat = <E, R>(
	chat: ChatState,
	{
		activeOrganizationId,
		botUsable: readBotUsable,
	}: {
		activeOrganizationId: OrganizationId;
		botUsable: Effect.Effect<boolean, E, R>;
	},
) =>
	Effect.gen(function* () {
		const botUsable =
			!chat.botId ||
			chat.botDeletedAt !== null ||
			chat.organizationId !== activeOrganizationId ||
			(yield* readBotUsable);

		switch (
			chatReadOnlyReason(chat, {
				activeOrganizationId,
				isMember: true,
				botUsable,
			})
		) {
			case null:
				return;
			case "bot-deleted":
				return yield* new AppErrors.BadRequestError({
					reason: "CHAT_BOT_DELETED",
					message:
						"The bot of this chat was deleted, so the chat is read-only. Export it to keep it.",
				});
			case "bot-unavailable":
				return yield* new AppErrors.BadRequestError({
					reason: "CHAT_BOT_UNAVAILABLE",
					message:
						"The bot of this chat is not available to you, so the chat is read-only.",
				});
			default:
				return yield* new AppErrors.BadRequestError({
					reason: "CHAT_ORGANIZATION_MISMATCH",
					message:
						"This chat belongs to another organisation. Switch to it to continue.",
				});
		}
	});
