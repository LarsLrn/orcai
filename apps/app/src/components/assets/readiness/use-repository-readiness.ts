import type { BlockId, BotId, ChatId } from "@orcai/core";
import { BLOCK_READINESS_MAX_IDS } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

/** How often readiness refreshes while an asset is still being prepared. */
const PREPARING_POLL_MS = 5000;

/**
 * Readiness of the readable repositories among `blockIds`, polled every five
 * seconds while some asset is still being prepared.
 */
export const useRepositoryReadiness = (blockIds: readonly BlockId[]) => {
	const ids = [
		...new Set(blockIds),
	]
		.sort()
		.slice(0, BLOCK_READINESS_MAX_IDS);

	return useQuery(
		orpc.block.readiness.queryOptions({
			input:
				ids.length > 0
					? {
							blockIds: ids,
						}
					: skipToken,
			refetchInterval: (query) =>
				query.state.data?.data.some(({ totals }) => totals.preparing > 0)
					? PREPARING_POLL_MS
					: false,
		}),
	);
};

/** The repositories of a bot. */
const useBotRepositoryIds = (botId: BotId | null | undefined) => {
	const { data } = useQuery(
		orpc.block.list.queryOptions({
			input: botId
				? {
						pageIndex: 0,
						pageSize: BLOCK_READINESS_MAX_IDS,
						filters: {
							botId,
							type: "database",
						},
					}
				: skipToken,
		}),
	);
	return botId ? (data?.data.map((block) => block.id) ?? []) : [];
};

/** The repositories a turn of the chat searches: its bot's and those attached to it. */
export const useChatRepositoryIds = (params: {
	chatId?: ChatId;
	botId?: BotId | null;
}) => {
	const botRepositoryIds = useBotRepositoryIds(params.botId);
	const { data: attached } = useQuery(
		orpc.chatBlock.list.queryOptions({
			input: params.chatId
				? {
						chatId: params.chatId,
					}
				: skipToken,
		}),
	);

	return [
		...botRepositoryIds,
		...(params.chatId ? (attached?.data ?? []) : [])
			.filter((block) => block.type === "database")
			.map((block) => block.id),
	];
};
