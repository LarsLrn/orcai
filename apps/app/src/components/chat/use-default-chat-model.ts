import type { ModelId } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

/** The model the server starts a new chat on, given the bot's recommendation. */
const defaultChatModelQuery = (recommendedModelId: ModelId | null) =>
	orpc.chat.defaultModel.queryOptions({
		input: {
			recommendedModelId: recommendedModelId ?? undefined,
		},
	});

/**
 * The model a new chat starts on when nothing requires or picks one, as the
 * server resolves it; idle while the bot's recommendation is unknown.
 */
const useDefaultChatModel = (
	recommendedModelId: ModelId | null | undefined,
) => {
	const { data, status } = useQuery(
		recommendedModelId === undefined
			? orpc.chat.defaultModel.queryOptions({
					input: skipToken,
				})
			: defaultChatModelQuery(recommendedModelId),
	);

	return {
		/** Whether the organisation has no model a chat can start on. */
		none: status === "success" && data.data === null,
		defaultModel: data?.data ?? null,
	};
};

export { defaultChatModelQuery, useDefaultChatModel };
