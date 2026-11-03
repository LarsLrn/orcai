import type { MutationFunctionContext } from "@tanstack/react-query";
import { executeBotEditorSave } from "@/components/authoring/bot-editor-save";
import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import {
	callProcedure,
	useMutationAction,
} from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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

export const usePublishBotMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.bot.publish.mutationOptions(),
		messages: {
			loading: () => m.bots_publish_toast_loading(),
			success: () => m.bots_publish_toast_success(),
			error: () => m.bots_publish_toast_error(),
		},
	});

export const useDeleteBotsMutation = (target?: DestructiveTarget) =>
	useDeleteAction({
		mutationOptions: () => orpc.bot.delete.mutationOptions(),
		copy: {
			loading: m.bots_delete_toast_loading,
			success: m.bots_delete_toast_success,
			error: m.bots_delete_toast_error,
			title: m.bots_delete_confirm_title,
			namedTitle: m.bots_delete_confirm_title_named,
			description: m.bots_delete_confirm_description,
			confirmText: m.bots_delete_confirm_button,
		},
		target,
	});

export const useSaveBotSetupMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.botSetup.save.mutationOptions(),
		messages: {
			loading: () => m.bot_setup_save_toast_loading(),
			success: () => m.bot_setup_save_toast_success(),
			error: () => m.bot_setup_save_toast_error(),
		},
	});
