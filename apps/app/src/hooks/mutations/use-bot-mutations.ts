import type {
	MutationFunction,
	MutationFunctionContext,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { executeBotEditorSave } from "@/components/authoring/bot-editor-save";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Calls a procedure through its mutation options, so the queries it makes stale are invalidated. */
const callProcedure =
	<TInput, TOutput>(
		options: {
			mutationFn?: MutationFunction<TOutput, TInput>;
		},
		context: MutationFunctionContext,
	) =>
	(input: TInput) => {
		if (!options.mutationFn) {
			throw new Error("Procedure mutation options lack a mutationFn");
		}
		return options.mutationFn(input, context);
	};

/** Saves the bot editor's changed blocks and bot as one action with one toast. */
export const useSaveBotEditorMutation = () => {
	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: (
				input: Parameters<typeof executeBotEditorSave>[0],
				context: MutationFunctionContext,
			) =>
				executeBotEditorSave(input, {
					createBlock: callProcedure(
						orpc.block.create.mutationOptions(),
						context,
					),
					updateBlock: callProcedure(
						orpc.block.update.mutationOptions(),
						context,
					),
					saveBot: callProcedure(orpc.bot.save.mutationOptions(), context),
				}),
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

	return useMutationAction({
		mutationOptions: () =>
			orpc.bot.publish.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					await router.navigate({
						to: "/app/hub/bots/$botId",
						params: {
							botId: result.data.id,
						},
						ignoreBlocker: true,
					});

					await opts.onSuccess?.(result, ...args);
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
	return useMutationAction({
		mutationOptions: () => orpc.bot.delete.mutationOptions(opts),
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

export const useSaveBotSetupMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.botSetup.save.mutationOptions(),
		messages: {
			loading: () => m.bot_setup_save_toast_loading(),
			success: () => m.bot_setup_save_toast_success(),
			error: () => m.bot_setup_save_toast_error(),
		},
	});
