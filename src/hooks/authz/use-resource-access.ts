import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import type { PrincipalType, ResourceRef } from "@/lib/orpc/schemas/resource";

const getResourceInput = (resourceRef: ResourceRef) => ({
	resourceType: resourceRef.type,
	resourceId: resourceRef.id,
});

const getGrantsOptions = (resourceRef: ResourceRef) =>
	orpc.resource.listGrants.queryOptions({
		input: getResourceInput(resourceRef),
	});

const getVisibilityOptions = (resourceRef: ResourceRef) =>
	orpc.resource.getVisibility.queryOptions({
		input: getResourceInput(resourceRef),
	});

export const useResourceGrants = (
	resourceRef: ResourceRef,
	options?: {
		enabled?: boolean;
	},
) =>
	useQuery({
		...getGrantsOptions(resourceRef),
		enabled: options?.enabled ?? true,
	});

export const useShareablePrincipals = (
	resourceRef: ResourceRef,
	query: string,
	options?: {
		enabled?: boolean;
		limit?: number;
		principalType?: PrincipalType;
	},
) =>
	useQuery(
		orpc.resource.listPrincipals.queryOptions({
			input: {
				...getResourceInput(resourceRef),
				principalType: options?.principalType,
				query: query.trim().length > 0 ? query.trim() : undefined,
				limit: options?.limit ?? 25,
			},
			enabled: options?.enabled ?? true,
		}),
	);

export const useResourceVisibility = (
	resourceRef: ResourceRef,
	options?: {
		enabled?: boolean;
	},
) =>
	useQuery({
		...getVisibilityOptions(resourceRef),
		enabled: options?.enabled ?? true,
	});

export const useGrantResourceAccess = (resourceRef: ResourceRef) => {
	const queryClient = useQueryClient();
	const grantsOptions = getGrantsOptions(resourceRef);

	return useMutationAction({
		mutationOptions: () =>
			orpc.resource.grant.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: grantsOptions.queryKey,
					});
				},
			}),
		messages: {
			loading: "Updating access...",
			success: "Access updated",
			error: "Failed to update access",
		},
	});
};

export const useRevokeResourceAccess = (resourceRef: ResourceRef) => {
	const queryClient = useQueryClient();
	const grantsOptions = getGrantsOptions(resourceRef);

	return useMutationAction({
		mutationOptions: () =>
			orpc.resource.revoke.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: grantsOptions.queryKey,
					});
				},
			}),
		messages: {
			loading: "Revoking access...",
			success: "Access revoked",
			error: "Failed to revoke access",
		},
		confirm: {
			title: "Revoke access",
			description:
				"This principal will lose their direct access to this resource.",
			confirmText: "Revoke",
			cancelText: "Cancel",
		},
	});
};

export const useSetResourceVisibility = (resourceRef: ResourceRef) => {
	const queryClient = useQueryClient();
	const visibilityOptions = getVisibilityOptions(resourceRef);

	return useMutationAction({
		mutationOptions: () =>
			orpc.resource.setVisibility.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: visibilityOptions.queryKey,
					});
				},
			}),
		messages: {
			loading: "Updating visibility...",
			success: ({ input }) =>
				input.visibility === "public"
					? "Resource is now public"
					: "Resource is now private",
			error: "Failed to update visibility",
		},
		confirm: (input) =>
			input.visibility === "private"
				? {
						title: "Make resource private",
						description:
							"Users outside direct or inherited access will lose visibility.",
						confirmText: "Make Private",
						cancelText: "Cancel",
					}
				: {
						title: "Publish resource",
						description:
							"This resource will be readable by authenticated users across organizations.",
						confirmText: "Publish",
						cancelText: "Cancel",
					},
	});
};
