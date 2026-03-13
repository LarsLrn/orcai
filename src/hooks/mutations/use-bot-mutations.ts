import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Deleting bots...",
			success: "Bots deleted",
			error: "Failed to delete bots",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Bot${plural}`,
				description: `Are you sure you want to delete ${count} bot${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
