import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
						to: "/instance/organizations",
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
			loading: m.orgs_create_toast_loading(),
			success: m.orgs_create_toast_success(),
			error: m.orgs_create_toast_error(),
		},
	});
};

export const useUpdateOrganizationMutation = (
	opts: ReturnType<typeof orpc.organization.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organization.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organization.key(),
					});

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
			loading: m.orgs_update_toast_loading(),
			success: m.orgs_update_toast_success(),
			error: m.orgs_update_toast_error(),
		},
	});
};

/** Deletes organisations. Confirmation is `DeleteOrganizationDialog`, not the generic prompt. */
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
			loading: m.orgs_delete_toast_loading(),
			success: m.orgs_delete_toast_success(),
			error: m.orgs_delete_toast_error(),
		},
	});
};
