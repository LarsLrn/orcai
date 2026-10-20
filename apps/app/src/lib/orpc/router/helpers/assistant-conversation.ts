import * as AppErrors from "@/lib/effect/utils/errors";

/** Assistant history and settings change only through the turn pipeline. */
export const assistantConversationImmutable = () =>
	new AppErrors.BadRequestError({
		reason: "ASSISTANT_CONVERSATION_IMMUTABLE",
		message: "Assistant conversations can only be renamed or deleted",
	});
