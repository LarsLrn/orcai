import type { InferClientInputs, InferClientOutputs } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { RouterUtils, RouterUtilsOptions } from "@orpc/tanstack-query";
import type { QueryKey } from "@tanstack/react-query";
import type { router } from "./router";

type AppClient = RouterClient<typeof router>;
type AppUtils = RouterUtils<AppClient>;
type Inputs = InferClientInputs<AppClient>;
type Outputs = InferClientOutputs<AppClient>;

type StaleQueries = {
	[Namespace in keyof Inputs]?: {
		[Procedure in keyof Inputs[Namespace] & keyof Outputs[Namespace]]?: (
			input: Inputs[Namespace][Procedure],
			output: Outputs[Namespace][Procedure],
		) => readonly QueryKey[];
	};
};

type MutationInterceptor = NonNullable<
	RouterUtilsOptions<AppClient>["mutationInterceptors"]
>[number];

/** The queries each mutation makes stale, keyed like the router. */
const staleQueriesOf = (orpc: AppUtils): StaleQueries => {
	const resourceAccess = ({
		resourceType,
		resourceId,
	}: Inputs["resource"]["listGrants"]) => {
		const input = {
			resourceType,
			resourceId,
		};

		return [
			orpc.resource.listGrants.key({
				input,
			}),
			orpc.resource.listPrincipals.key({
				input,
			}),
			orpc.user.listAccess.key(),
		];
	};
	const groupMembership = ({ groupId }: Inputs["group"]["addMembers"]) => [
		orpc.group.listMembers.key({
			input: {
				groupId,
			},
		}),
		orpc.group.listCandidates.key({
			input: {
				groupId,
			},
		}),
		orpc.user.listAccess.key(),
	];

	return {
		asset: {
			addToLibrary: () => [
				orpc.asset.key(),
			],
			createFromUploads: () => [
				orpc.asset.key(),
			],
			save: () => [
				orpc.asset.key(),
			],
			delete: () => [
				orpc.asset.key(),
			],
		},
		assistant: {
			create: () => [
				orpc.assistant.key(),
			],
		},
		block: {
			create: () => [
				orpc.block.key(),
			],
			update: () => [
				orpc.block.key(),
			],
			delete: () => [
				orpc.block.key(),
			],
		},
		bot: {
			save: () => [
				orpc.bot.key(),
			],
			publish: () => [
				orpc.bot.key(),
			],
			setFavourite: () => [
				orpc.bot.key(),
			],
			delete: () => [
				orpc.bot.key(),
			],
		},
		chat: {
			create: () => [
				orpc.chat.key(),
			],
			update: () => [
				orpc.chat.key(),
				orpc.assistant.key(),
			],
			delete: () => [
				orpc.chat.key(),
				orpc.assistant.key(),
			],
			branch: () => [
				orpc.chat.key(),
			],
		},
		chatBlock: {
			attach: ({ chatId }) => [
				orpc.chatBlock.list.key({
					input: {
						chatId,
					},
				}),
			],
			detach: ({ chatId }) => [
				orpc.chatBlock.list.key({
					input: {
						chatId,
					},
				}),
			],
		},
		chatMessage: {
			rate: ({ chatId }) => [
				orpc.chatMessage.listRatings.key({
					input: {
						chatId,
					},
				}),
			],
		},
		group: {
			create: () => [
				orpc.group.key(),
			],
			update: () => [
				orpc.group.key(),
			],
			delete: () => [
				orpc.group.key(),
			],
			addMembers: groupMembership,
			removeMembers: groupMembership,
		},
		job: {
			create: () => [
				orpc.job.key(),
			],
			retryProcessing: () => [
				orpc.job.key(),
				orpc.asset.key(),
			],
			retryVectorization: () => [
				orpc.job.key(),
			],
		},
		model: {
			create: () => [
				orpc.model.key(),
			],
			update: () => [
				orpc.model.key(),
			],
			delete: () => [
				orpc.model.key(),
			],
			discover: () => [
				orpc.model.key(),
			],
		},
		organization: {
			create: () => [
				orpc.organization.key(),
			],
			update: () => [
				orpc.organization.key(),
			],
			delete: () => [
				orpc.organization.key(),
			],
		},
		organizationInvitation: {
			create: () => [
				orpc.organizationInvitation.key(),
			],
			update: () => [
				orpc.organizationInvitation.key(),
			],
			delete: () => [
				orpc.organizationInvitation.key(),
			],
			respond: ({ response }) => [
				orpc.organizationInvitation.key(),
				...(response === "accept"
					? [
							orpc.organization.key(),
						]
					: []),
			],
		},
		organizationMember: {
			update: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
				orpc.authorization.key(),
			],
			delete: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
			],
		},
		provider: {
			create: () => [
				orpc.provider.key(),
			],
			update: () => [
				orpc.provider.key(),
			],
			delete: () => [
				orpc.provider.key(),
			],
		},
		quota: {
			create: () => [
				orpc.quota.key(),
			],
			update: () => [
				orpc.quota.key(),
			],
			deactivate: () => [
				orpc.quota.key(),
			],
		},
		resource: {
			grant: resourceAccess,
			revoke: resourceAccess,
			setVisibility: (input) => [
				orpc.resource.getVisibility.key({
					input: {
						resourceType: input.resourceType,
						resourceId: input.resourceId,
					},
				}),
				orpc.user.listAccess.key(),
			],
		},
		storage: {
			createUploadUrls: () => [
				orpc.storage.key(),
			],
		},
		user: {
			delete: () => [
				orpc.user.key(),
			],
			ban: () => [
				orpc.user.key(),
			],
			unban: () => [
				orpc.user.key(),
			],
			setTourState: () => [
				orpc.user.me.key(),
			],
		},
	};
};

/**
 * Invalidates what a mutation made stale once it succeeds, before its
 * `onSuccess` runs; call sites cannot override it. Active queries refetch in
 * the background, since a deleted entity's own query would hold the mutation
 * through its retries.
 */
export const invalidateStaleQueries = (
	orpc: () => AppUtils,
): MutationInterceptor => {
	let staleQueries: StaleQueries | undefined;

	return async ({ path, input, fnContext, next }) => {
		const output = await next();
		staleQueries ??= staleQueriesOf(orpc());
		const [namespace = "", procedure = ""] = path;
		const keysOf = (
			staleQueries as Record<
				string,
				| Record<
						string,
						| ((input: unknown, output: unknown) => readonly QueryKey[])
						| undefined
				  >
				| undefined
			>
		)[namespace]?.[procedure];

		for (const queryKey of keysOf?.(input, output) ?? []) {
			void fnContext.client.invalidateQueries({
				queryKey,
			});
		}

		return output;
	};
};
