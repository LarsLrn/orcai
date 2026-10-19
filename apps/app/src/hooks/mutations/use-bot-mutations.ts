import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
			loading: () => m.bots_save_toast_loading(),
			success: () => m.bots_save_toast_success(),
			error: () => m.bots_save_toast_error(),
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
						ignoreBlocker: true,
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
			loading: () => m.bots_publish_toast_loading(),
			success: () => m.bots_publish_toast_success(),
			error: () => m.bots_publish_toast_error(),
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
				m.bots_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.bots_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.bots_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.bots_delete_confirm_title_named({
							name,
						})
					: m.bots_delete_confirm_title({
							count,
						}),
				description: m.bots_delete_confirm_description({
					count,
				}),
				confirmText: m.bots_delete_confirm_button({
					count,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
