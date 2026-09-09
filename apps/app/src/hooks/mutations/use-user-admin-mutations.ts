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

const ACCOUNT_NOUNS = {
	noun: "account",
	nounPlural: "accounts",
};

export const useDeleteUsersMutation = (
	opts: ReturnType<typeof orpc.user.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteUsersMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress(
					"Deleting",
					input.userIds.length,
					ACCOUNT_NOUNS,
					target,
				),
			success: ({ input }) =>
				describeOutcome(input.userIds.length, ACCOUNT_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.userIds.length, ACCOUNT_NOUNS, "deleted", target),
		},
		// "Delete" is the confirm label the instance users e2e spec clicks.
		confirm: (input) => {
			const count = input.userIds.length;

			return {
				title: `Delete ${describeTarget(count, ACCOUNT_NOUNS, target)}?`,
				description:
					count === 1
						? "The account leaves every organisation it belongs to, and the person can no longer sign in. Deletion is permanent."
						: "The accounts leave every organisation they belong to, and those people can no longer sign in. Deletion is permanent.",
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};

export const useBanUserMutation = (
	opts: ReturnType<typeof orpc.user.ban.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.ban.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useBanUserMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Banning the account...",
			success: "Account banned",
			error: "The account was not banned. Try again.",
		},
		confirm: {
			title: `Ban ${describeTarget(1, ACCOUNT_NOUNS, target)}?`,
			description:
				"The person cannot sign in until the ban is lifted. Their memberships and resources stay in place.",
			confirmText: "Ban",
			cancelText: "Cancel",
		},
	});
};

export const useUnbanUserMutation = (
	opts: ReturnType<typeof orpc.user.unban.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.unban.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUnbanUserMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Lifting the ban...",
			success: "Ban lifted",
			error: "The ban was not lifted. Try again.",
		},
	});
};
