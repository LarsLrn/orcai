import type { GroupId } from "@orcai/core";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { orpc } from "@/lib/orpc/orpc";

const GROUP_NOUNS = {
	noun: "group",
	nounPlural: "groups",
};

const MEMBER_NOUNS = {
	noun: "member",
	nounPlural: "members",
};

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
			loading: "Creating group...",
			success: "Group created",
			error: "The group was not created. Check the name and try again.",
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
			loading: "Saving group...",
			success: "Group updated",
			error: "The group was not updated. Try again.",
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
				describeProgress("Deleting", input.refs.length, GROUP_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, GROUP_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, GROUP_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, GROUP_NOUNS, target)}?`,
				description:
					count === 1
						? "Every grant this group carries is revoked, so its members lose the access it gave them. Their accounts stay."
						: "Every grant these groups carry is revoked, so their members lose the access those groups gave them. Their accounts stay.",
				confirmText: "Delete",
				cancelText: "Cancel",
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
			loading: "Adding members...",
			success: "Members added",
			error: "The members were not added. Try again.",
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
			loading: "Removing the member...",
			success: "Member removed",
			error: "The member was not removed. Try again.",
		},
		confirm: (input) => {
			const count = input.userIds.length;

			return {
				title: `Remove ${describeTarget(count, MEMBER_NOUNS)} from the group?`,
				description:
					count === 1
						? "They lose the access this group gives them. Their account and their own resources stay."
						: "They lose the access this group gives them. Their accounts and their own resources stay.",
				confirmText: "Remove",
				cancelText: "Cancel",
			};
		},
	});
};
