import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useCreateOrganizationMutation = (
	opts: ReturnType<typeof orpc.organization.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organization.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organization.key(),
					});

					await router.navigate({
						to: "/app/orgs/$orgId",
						params: {
							orgId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateOrganizationMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Creating organisation...",
			success: "Organisation created successfully",
			error: "Failed to create organisation",
		},
	});
};

export const useUpdateOrganizationMutation = (
	opts: ReturnType<typeof orpc.organization.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organization.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organization.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateOrganizationMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating organisation...",
			success: "Organisation updated successfully",
			error: "Failed to update organisation",
		},
	});
};

export const useDeleteOrganizationsMutation = (
	opts: ReturnType<typeof orpc.organization.delete.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organization.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organization.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteOrganizationsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Deleting organisations...",
			success: "Organisations deleted",
			error: "Failed to delete organisations",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Organisation${plural}`,
				description: `Are you sure you want to delete ${count} organisation${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
