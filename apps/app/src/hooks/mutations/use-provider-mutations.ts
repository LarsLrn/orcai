import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateProviderMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.provider.create.mutationOptions(),
		messages: {
			loading: m.providers_create_toast_loading(),
			success: m.providers_create_toast_success(),
			error: m.providers_create_toast_error(),
		},
	});

export const useUpdateProviderMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.provider.update.mutationOptions(),
		messages: {
			loading: m.providers_update_toast_loading(),
			success: m.providers_update_toast_success(),
			error: m.providers_update_toast_error(),
		},
	});

export const useDeleteProvidersMutation = (target?: DestructiveTarget) =>
	useDeleteAction({
		mutationOptions: () => orpc.provider.delete.mutationOptions(),
		copy: {
			loading: m.providers_delete_toast_loading,
			success: m.providers_delete_toast_success,
			error: m.providers_delete_toast_error,
			title: m.providers_delete_confirm_title,
			namedTitle: m.providers_delete_confirm_title_named,
			description: m.providers_delete_confirm_description,
			confirmText: m.providers_delete_confirm_button,
		},
		target,
	});
