import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeAction,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { orpc } from "@/lib/orpc/orpc";

const BOT_NOUNS = {
	noun: "bot",
	nounPlural: "bots",
};

export const useSaveBotMutation = (
	opts: ReturnType<typeof orpc.bot.save.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.bot.save.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.bot.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSaveBotMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Saving bot...",
			success: "Bot saved",
			error: "Failed to save bot",
		},
	});
};

export const usePublishBotMutation = (
	opts: ReturnType<typeof orpc.bot.publish.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.bot.publish.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.bot.key(),
					});

					await router.navigate({
						to: "/app/hub/bots/$botId",
						params: {
							botId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"usePublishBotMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Publishing bot...",
			success: "Bot published",
			error: "Failed to publish bot",
		},
	});
};

export const useDeleteBotsMutation = (
	opts: ReturnType<typeof orpc.bot.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.bot.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.bot.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteBotsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress("Deleting", input.refs.length, BOT_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, BOT_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, BOT_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, BOT_NOUNS, target)}?`,
				description:
					count === 1
						? "Everyone it was shared with loses access. Chats that used it keep their messages but lose the bot."
						: "Everyone they were shared with loses access. Chats that used them keep their messages but lose the bot.",
				confirmText: describeAction("Delete", count, BOT_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};
