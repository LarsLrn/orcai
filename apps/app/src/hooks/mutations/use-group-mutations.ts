import type { listGroupCandidatesResponseSchema } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod/v4";
import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type GroupCandidates = z.infer<typeof listGroupCandidatesResponseSchema>;

export const useCreateGroupMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.group.create.mutationOptions(),
		messages: {
			loading: m.groups_create_toast_loading(),
			success: m.groups_create_toast_success(),
			error: m.groups_create_toast_error(),
		},
	});
};

export const useUpdateGroupMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.group.update.mutationOptions(),
		messages: {
			loading: m.groups_update_toast_loading(),
			success: m.groups_update_toast_success(),
			error: m.groups_update_toast_error(),
		},
	});
};

export const useDeleteGroupsMutation = (target?: DestructiveTarget) =>
	useDeleteAction({
		mutationOptions: () => orpc.group.delete.mutationOptions(),
		copy: {
			loading: m.groups_delete_toast_loading,
			success: m.groups_delete_toast_success,
			error: m.groups_delete_toast_error,
			title: m.groups_delete_confirm_title,
			namedTitle: m.groups_delete_confirm_title_named,
			description: m.groups_delete_confirm_description,
			confirmText: m.common_delete_button,
		},
		target,
	});

export const useAddGroupMembersMutation = () => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.group.addMembers.mutationOptions({
				onSuccess: (_data, { groupId, userIds }) => {
					// Added users leave the picker at once rather than when its
					// refetch lands.
					const added = new Set(userIds);

					queryClient.setQueriesData<GroupCandidates>(
						{
							queryKey: orpc.group.listCandidates.key({
								input: {
									groupId,
								},
							}),
						},
						(candidates) => {
							if (!candidates) {
								return candidates;
							}

							const data = candidates.data.filter(
								(user) => !added.has(user.id),
							);

							return {
								...candidates,
								data,
								rowCount:
									candidates.rowCount - (candidates.data.length - data.length),
							};
						},
					);
				},
			}),
		messages: {
			loading: m.groups_members_add_toast_loading(),
			success: m.groups_members_add_toast_success(),
			error: m.groups_members_add_toast_error(),
		},
	});
};

export const useRemoveGroupMembersMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.group.removeMembers.mutationOptions(),
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
			};
		},
	});
