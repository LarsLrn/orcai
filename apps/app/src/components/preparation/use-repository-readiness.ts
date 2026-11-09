import type { BlockId, BotId, ChatId } from "@orcai/core";
import { BLOCK_READINESS_MAX_IDS } from "@orcai/schema";
import { type QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

/** How often readiness refreshes while an asset is still being prepared. */
const PREPARING_POLL_MS = 5000;

/**
 * Readiness of the readable repositories among `blockIds`, polled every five
 * seconds while some asset is still being prepared.
 */
const readinessIds = (blockIds: readonly BlockId[]) =>
	[
		...new Set(blockIds),
	]
		.sort()
		.slice(0, BLOCK_READINESS_MAX_IDS);

export const useRepositoryReadiness = (blockIds: readonly BlockId[]) => {
	const ids = readinessIds(blockIds);

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

/** Loads the readiness `useRepositoryReadiness` reads for `blockIds`. */
export const loadRepositoryReadiness = async (
	queryClient: QueryClient,
	blockIds: readonly BlockId[],
) => {
	const ids = readinessIds(blockIds);
	if (ids.length === 0) return;
	await queryClient.query(
		orpc.block.readiness.queryOptions({
			input: {
				blockIds: ids,
			},
		}),
	);
};

const botRepositoriesInput = (botId: BotId) => ({
	pageIndex: 0,
	pageSize: BLOCK_READINESS_MAX_IDS,
	filters: {
		botId,
		type: "repository" as const,
	},
});

/** The repositories of a bot. */
const useBotRepositoryIds = (botId: BotId | null | undefined) => {
	const { data } = useQuery(
		orpc.block.list.queryOptions({
			input: botId ? botRepositoriesInput(botId) : skipToken,
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
			.filter((block) => block.type === "repository")
			.map((block) => block.id),
	];
};

/** Loads the repositories a chat turn searches and their readiness, as `useChatRepositoryIds` and `useRepositoryReadiness` read them. */
export const loadChatRepositoryReadiness = async (
	queryClient: QueryClient,
	params: {
		chatId?: ChatId;
		botId?: BotId | null;
	},
) => {
	const [bot, attached] = await Promise.allSettled([
		params.botId
			? queryClient.query(
					orpc.block.list.queryOptions({
						input: botRepositoriesInput(params.botId),
					}),
				)
			: undefined,
		params.chatId
			? queryClient.query(
					orpc.chatBlock.list.queryOptions({
						input: {
							chatId: params.chatId,
						},
					}),
				)
			: undefined,
	]);
	const listed = <T>(result: PromiseSettledResult<T>) =>
		result.status === "fulfilled" ? result.value : undefined;
	await loadRepositoryReadiness(queryClient, [
		...(listed(bot)?.data ?? []).map((block) => block.id),
		...(listed(attached)?.data ?? [])
			.filter((block) => block.type === "repository")
			.map((block) => block.id),
	]);
};
