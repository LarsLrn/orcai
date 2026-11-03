import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateModelMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.model.create.mutationOptions(),
		messages: {
			loading: m.models_create_toast_loading(),
			success: m.models_create_toast_success(),
			error: m.models_create_toast_error(),
		},
	});

export const useUpdateModelMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.model.update.mutationOptions(),
		messages: {
			loading: m.models_update_toast_loading(),
			success: m.models_update_toast_success(),
			error: m.models_update_toast_error(),
		},
	});

export const useDeleteModelsMutation = (target?: DestructiveTarget) =>
	useDeleteAction({
		mutationOptions: () => orpc.model.delete.mutationOptions(),
		copy: {
			loading: m.models_delete_toast_loading,
			success: m.models_delete_toast_success,
			error: m.models_delete_toast_error,
			title: m.models_delete_confirm_title,
			namedTitle: m.models_delete_confirm_title_named,
			description: m.models_delete_confirm_description,
			confirmText: m.models_delete_confirm_button,
		},
		target,
	});
