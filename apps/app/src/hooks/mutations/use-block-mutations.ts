import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type BlockDeleteTarget = DestructiveTarget & {
	kind?: "block" | "repository" | "behaviour";
};

export const useCreateBlockMutation = (
	opts: ReturnType<typeof orpc.block.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () => {
			return orpc.block.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					await router.navigate({
						to: "/app/hub/blocks/$blockId",
						params: {
							blockId: result.data.id,
						},
						ignoreBlocker: true,
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			});
		},
		messages: {
			loading: () => m.blocks_create_toast_loading(),
			success: () => m.blocks_create_toast_success(),
			error: () => m.blocks_create_toast_error(),
		},
	});
};

export const useUpdateBlockMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: () => m.blocks_update_toast_loading(),
			success: () => m.blocks_update_toast_success(),
			error: () => m.blocks_update_toast_error(),
		},
	});
};

export const useDeleteBlocksMutation = (
	opts: ReturnType<typeof orpc.block.delete.mutationOptions> = {},
	target?: BlockDeleteTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteBlocksMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				m.blocks_delete_toast_loading({
					count: input.refs.length,
					kind: target?.kind ?? "block",
				}),
			success: ({ input }) =>
				m.blocks_delete_toast_success({
					count: input.refs.length,
					kind: target?.kind ?? "block",
				}),
			error: ({ input }) =>
				m.blocks_delete_toast_error({
					count: input.refs.length,
					kind: target?.kind ?? "block",
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const kind = target?.kind ?? "block";
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.blocks_delete_confirm_title_named({
							kind,
							name,
						})
					: m.blocks_delete_confirm_title({
							count,
							kind,
						}),
				description: m.blocks_delete_confirm_description({
					count,
				}),
				confirmText: m.blocks_delete_confirm_button({
					count,
					kind,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};

export const useSetBlockStatusMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSetBlockStatusMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
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

export const useCreateBlockInlineMutation = (
	opts: ReturnType<typeof orpc.block.create.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useCreateBlockInlineMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: () => m.blocks_create_inline_toast_loading(),
			success: () => m.blocks_create_inline_toast_success(),
			error: () => m.blocks_create_inline_toast_error(),
		},
	});
};

export const useUpdateBlockInlineMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateBlockInlineMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: () => m.blocks_update_inline_toast_loading(),
			success: () => m.blocks_update_inline_toast_success(),
			error: () => m.blocks_update_inline_toast_error(),
		},
	});
};
