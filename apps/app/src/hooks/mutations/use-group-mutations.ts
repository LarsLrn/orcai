import type { GroupId } from "@orcai/core";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const invalidateGroupMembership = (
	queryClient: QueryClient,
	groupId: GroupId,
) => {
	queryClient.invalidateQueries({
		queryKey: orpc.group.listMembers.key({
			input: {
				groupId,
			},
		}),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.group.listCandidates.key({
			input: {
				groupId,
			},
		}),
	});
};

export const useCreateGroupMutation = (
	opts: ReturnType<typeof orpc.group.create.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useCreateGroupMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.groups_create_toast_loading(),
			success: m.groups_create_toast_success(),
			error: m.groups_create_toast_error(),
		},
	});
};

export const useUpdateGroupMutation = (
	opts: ReturnType<typeof orpc.group.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateGroupMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.groups_update_toast_loading(),
			success: m.groups_update_toast_success(),
			error: m.groups_update_toast_error(),
		},
	});
};

export const useDeleteGroupsMutation = (
	opts: ReturnType<typeof orpc.group.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteGroupsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				m.groups_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.groups_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.groups_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.groups_delete_confirm_title_named({
							name,
						})
					: m.groups_delete_confirm_title({
							count,
						}),
				description: m.groups_delete_confirm_description({
					count,
				}),
				confirmText: m.common_delete_button(),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};

export const useAddGroupMembersMutation = (groupId: GroupId) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.addMembers.mutationOptions({
				onSuccess: () => {
					invalidateGroupMembership(queryClient, groupId);
				},
			}),
		messages: {
			loading: m.groups_members_add_toast_loading(),
			success: m.groups_members_add_toast_success(),
			error: m.groups_members_add_toast_error(),
		},
	});
};

export const useRemoveGroupMembersMutation = (groupId: GroupId) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.removeMembers.mutationOptions({
				onSuccess: () => {
					invalidateGroupMembership(queryClient, groupId);
				},
			}),
		messages: {
			loading: m.groups_members_remove_toast_loading(),
			success: m.groups_members_remove_toast_success(),
			error: m.groups_members_remove_toast_error(),
		},
		confirm: (input) => {
			const count = input.userIds.length;

			return {
				title: m.groups_members_remove_confirm_title({
					count,
				}),
				description: m.groups_members_remove_confirm_description({
					count,
				}),
				confirmText: m.common_remove_button(),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
