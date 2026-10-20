import type { BlockId } from "@orcai/core";
import type {
	PrincipalType,
	ResourcePrincipalIdentity,
	ResourceRef,
} from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { client, orpc } from "@/lib/orpc/orpc";
import { formatList } from "@/lib/presentation/format-list";
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

const principalKey = (principal: {
	principalType: PrincipalType;
	principalId: string;
}) => `${principal.principalType}:${principal.principalId}`;

/**
 * Gives the principals `editor` on each block, skipping those who already
 * hold `editor` or `manager` there. Blocks run independently; one warning
 * names the blocks that failed.
 */
export const useGrantBlockEdit = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			blocks,
			principals,
		}: {
			blocks: {
				id: BlockId;
				name: string;
			}[];
			principals: ResourcePrincipalIdentity[];
		}) => {
			const outcomes = await Promise.allSettled(
				blocks.map(async (block) => {
					const resourceRef = {
						type: "block",
						id: block.id,
					} as const;
					const grants = await queryClient.query({
						...getGrantsOptions(resourceRef),
						staleTime: 0,
					});
					const holdsEdit = new Set(
						grants.data
							.filter(
								(grant) => grant.role === "editor" || grant.role === "manager",
							)
							.map(principalKey),
					);
					const missing = principals.filter(
						(principal) => !holdsEdit.has(principalKey(principal)),
					);

					if (missing.length === 0) {
						return;
					}

					await client.resource.grant({
						resourceType: "block",
						resourceId: block.id,
						principals: missing,
						role: "editor",
					});
					invalidateResourceAccess(queryClient, resourceRef);
				}),
			);

			const failed = blocks.filter(
				(_, index) => outcomes[index]?.status === "rejected",
			);
			if (failed.length > 0) {
				toast.warning(
					m.access_grant_blocks_partial_toast({
						names: formatList(failed.map((block) => block.name)),
					}),
				);
			}
		},
	});
};
