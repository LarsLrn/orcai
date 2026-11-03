import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type BlockDeleteTarget = DestructiveTarget & {
	kind?: "block" | "repository" | "behaviour";
};

export const useCreateBlockMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.block.create.mutationOptions(),
		messages: {
			loading: () => m.blocks_create_toast_loading(),
			success: () => m.blocks_create_toast_success(),
			error: () => m.blocks_create_toast_error(),
		},
	});

export const useUpdateBlockMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.block.update.mutationOptions(),
		messages: {
			loading: () => m.blocks_update_toast_loading(),
			success: () => m.blocks_update_toast_success(),
			error: () => m.blocks_update_toast_error(),
		},
	});
};

export const useDeleteBlocksMutation = (target?: BlockDeleteTarget) => {
	const kind = target?.kind ?? "block";

	return useDeleteAction({
		mutationOptions: () => orpc.block.delete.mutationOptions(),
		copy: {
			loading: ({ count }) =>
				m.blocks_delete_toast_loading({
					count,
					kind,
				}),
			success: ({ count }) =>
				m.blocks_delete_toast_success({
					count,
					kind,
				}),
			error: ({ count }) =>
				m.blocks_delete_toast_error({
					count,
					kind,
				}),
			title: ({ count }) =>
				m.blocks_delete_confirm_title({
					count,
					kind,
				}),
			namedTitle: ({ name }) =>
				m.blocks_delete_confirm_title_named({
					kind,
					name,
				}),
			description: m.blocks_delete_confirm_description,
			confirmText: ({ count }) =>
				m.blocks_delete_confirm_button({
					count,
					kind,
				}),
		},
		target,
	});
};

export const useSetBlockStatusMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.block.update.mutationOptions(),
		messages: {
			loading: () => m.blocks_status_toast_loading(),
			success: ({ input }) =>
				input.status === "ready"
					? m.blocks_status_toast_success_ready()
					: m.blocks_status_toast_success_draft(),
			error: () => m.blocks_status_toast_error(),
		},
	});
};

export const usePrepareRepositoryAssetAgainMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.block.prepareAssetAgain.mutationOptions(),
		messages: {
			loading: m.blocks_prepare_asset_again_toast_loading(),
			success: m.blocks_prepare_asset_again_toast_success(),
			error: m.blocks_prepare_asset_again_toast_error(),
		},
	});
};

export const usePrepareRepositoryFailedAgainMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.block.prepareFailedAgain.mutationOptions(),
		messages: {
			loading: m.blocks_prepare_failed_again_toast_loading(),
			success: ({ data }) =>
				m.blocks_prepare_failed_again_toast_success({
					count: data.processing + data.indexing,
				}),
			error: m.blocks_prepare_failed_again_toast_error(),
		},
	});
};
