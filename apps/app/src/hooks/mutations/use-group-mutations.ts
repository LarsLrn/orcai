import type { listGroupCandidatesResponseSchema } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod/v4";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type GroupCandidates = z.infer<typeof listGroupCandidatesResponseSchema>;

export const useCreateGroupMutation = (
	opts: ReturnType<typeof orpc.group.create.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.group.create.mutationOptions(opts),
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
	return useMutationAction({
		mutationOptions: () => orpc.group.update.mutationOptions(opts),
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
	return useMutationAction({
		mutationOptions: () => orpc.group.delete.mutationOptions(opts),
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
				cancelText: m.common_cancel_button(),
			};
		},
	});
