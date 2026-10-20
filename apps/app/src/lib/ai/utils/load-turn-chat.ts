import type { ChatId, OrganizationId } from "@orcai/core";
import { DB } from "@orcai/db";
import type { ChatKind } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Refuses a turn on a missing chat, or on an assistant conversation of another organisation. */
export const checkTurnChat = <
	Chat extends {
		kind: ChatKind;
		organizationId: OrganizationId | null;
	},
>({
	chatId,
	chat,
	activeOrganizationId,
}: {
	chatId: ChatId;
	chat: Chat | undefined;
	activeOrganizationId: OrganizationId;
}): Effect.Effect<
	Chat,
	AppErrors.NotFoundError | AppErrors.BadRequestError
> => {
	if (!chat) {
		return Effect.fail(
			new AppErrors.NotFoundError({
				reason: "CHAT_NOT_FOUND",
				id: chatId,
				message: "Chat not found",
			}),
		);
	}

	if (
		chat.kind === "assistant" &&
		chat.organizationId !== activeOrganizationId
	) {
		return Effect.fail(
			new AppErrors.BadRequestError({
				reason: "ASSISTANT_ORGANIZATION_MISMATCH",
				message:
					"This assistant conversation belongs to another organisation. Switch to it to continue.",
			}),
		);
	}

	return Effect.succeed(chat);
};

/** The chat a turn runs on, loaded and checked against the active organisation. */
export const loadTurnChat = ({
	chatId,
	activeOrganizationId,
}: {
	chatId: ChatId;
	activeOrganizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const chat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: chatId,
				},
			},
		});

		return yield* checkTurnChat({
			chatId,
			chat,
			activeOrganizationId,
		});
	});
