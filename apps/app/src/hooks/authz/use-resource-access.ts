import type { PrincipalType, ResourceRef } from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const getResourceInput = (resourceRef: ResourceRef) => {
	switch (resourceRef.type) {
		case "asset":
			return {
				resourceType: "asset" as const,
				resourceId: resourceRef.id,
			};
		case "block":
			return {
				resourceType: "block" as const,
				resourceId: resourceRef.id,
			};
		case "bot":
			return {
				resourceType: "bot" as const,
				resourceId: resourceRef.id,
			};
	}
};

const getGrantsOptions = (resourceRef: ResourceRef) =>
	orpc.resource.listGrants.queryOptions({
		input: getResourceInput(resourceRef),
	});

const invalidateResourceAccess = (
	queryClient: QueryClient,
	resourceRef: ResourceRef,
) => {
	queryClient.invalidateQueries({
		queryKey: getGrantsOptions(resourceRef).queryKey,
	});
	queryClient.invalidateQueries({
		queryKey: orpc.resource.listPrincipals.key({
			input: getResourceInput(resourceRef),
		}),
	});
};

export const useInheritedAccess = (resourceRef: ResourceRef) =>
	useQuery(
		orpc.resource.inheritedAccess.queryOptions({
			input: getResourceInput(resourceRef),
		}),
	);

const getVisibilityOptions = (resourceRef: ResourceRef) =>
	orpc.resource.getVisibility.queryOptions({
		input: getResourceInput(resourceRef),
	});

export const useResourceGrants = (
	resourceRef: ResourceRef | undefined,
	options?: {
		enabled?: boolean;
	},
) =>
	useQuery(
		orpc.resource.listGrants.queryOptions({
			input: resourceRef ? getResourceInput(resourceRef) : skipToken,
			enabled: (options?.enabled ?? true) && !!resourceRef,
		}),
	);

export const useShareablePrincipals = (
	resourceRef: ResourceRef,
	query: string,
	options: {
		limit: number;
		principalType: PrincipalType;
	},
) =>
	useQuery(
		orpc.resource.listPrincipals.queryOptions({
			input: {
				...getResourceInput(resourceRef),
				principalType: options.principalType,
				query: query.trim().length > 0 ? query.trim() : undefined,
				limit: options.limit,
				excludeGranted: true,
			},
		}),
	);

export const useResourceVisibility = (
	resourceRef: ResourceRef | undefined,
	options?: {
		enabled?: boolean;
	},
) =>
	useQuery(
		orpc.resource.getVisibility.queryOptions({
			input: resourceRef ? getResourceInput(resourceRef) : skipToken,
			enabled: (options?.enabled ?? true) && !!resourceRef,
		}),
	);

export const useGrantResourceAccess = (resourceRef: ResourceRef) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.resource.grant.mutationOptions({
				onSuccess: () => {
					invalidateResourceAccess(queryClient, resourceRef);
				},
			}),
		messages: {
			loading: m.access_grant_toast_loading(),
			success: m.access_grant_toast_success(),
			error: m.access_grant_toast_error(),
		},
	});
};

export const useRevokeResourceAccess = (resourceRef: ResourceRef) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.resource.revoke.mutationOptions({
				onSuccess: () => {
					invalidateResourceAccess(queryClient, resourceRef);
				},
			}),
		messages: {
			loading: m.access_revoke_toast_loading(),
			success: m.access_revoke_toast_success(),
			error: m.access_revoke_toast_error(),
		},
		confirm: {
			title: m.access_revoke_confirm_title(),
			description: m.access_revoke_confirm_description(),
			confirmText: m.access_revoke_confirm_button(),
			cancelText: m.common_cancel_button(),
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
			loading: m.access_visibility_toast_loading(),
			success: ({ input }) =>
				input.visibility === "public"
					? m.access_visibility_toast_public()
					: m.access_visibility_toast_private(),
			error: m.access_visibility_toast_error(),
		},
		confirm: (input) =>
			input.visibility === "private"
				? {
						title: m.access_make_private_confirm_title(),
						description: m.access_make_private_confirm_description(),
						confirmText: m.access_make_private_confirm_button(),
						cancelText: m.common_cancel_button(),
					}
				: {
						title: m.access_publish_confirm_title(),
						description: m.access_publish_confirm_description(),
						confirmText: m.access_publish_confirm_button(),
						cancelText: m.common_cancel_button(),
					},
	});
};
