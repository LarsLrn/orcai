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
	// A chat turns read-only or writable with access to its bot and organisation.
	const readOnlyChats = orpc.chat.find.key();
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
			readOnlyChats,
			orpc.botSetup.coverage.key(),
		];
	};
	// Organisation readiness reads providers, models, pools, groups and members.
	const readiness = orpc.readiness.key();

	// Group lists and quota pools show each group's member count.
	const groupSummaries = () => [
		orpc.group.list.key(),
		orpc.quota.find.key(),
	];
	const groupMembership = ({ groupId }: Inputs["group"]["addMembers"]) => [
		...groupSummaries(),
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
		readiness,
		readOnlyChats,
		orpc.botSetup.coverage.key(),
	];

	const instanceMembership = () => [
		orpc.instance.key(),
		orpc.organization.listAll.key(),
		orpc.user.listAll.key(),
		orpc.organizationMember.key(),
		orpc.user.list.key(),
		readiness,
		...groupSummaries(),
	];

	// Library tiles show their creator.
	const libraryLists = () => [
		orpc.bot.list.key(),
		orpc.block.list.key(),
		orpc.asset.list.key(),
		orpc.library.key(),
	];

	// Lists of people and organisations show pictures and logos.
	const pictures = () => [
		orpc.user.key(),
		orpc.organizationMember.key(),
		orpc.instance.key(),
		...libraryLists(),
	];
	const logos = () => [
		orpc.organization.key(),
		orpc.organizationInvitation.key(),
		orpc.instance.key(),
	];

	// A provider's page counts its models.
	// A bot's setup and the chats it requires a model for show whether the model is usable.
	// Bot tiles name the model their setup asks for.
	const models = () => [
		orpc.model.key(),
		orpc.provider.find.key(),
		readiness,
		orpc.botSetup.key(),
		readOnlyChats,
		orpc.bot.list.key(),
		orpc.library.key(),
	];

	// Readiness lists each document's title and state; repository tiles count them.
	const assetsAndReadiness = () => [
		orpc.asset.key(),
		orpc.block.readiness.key(),
		orpc.block.list.key(),
		orpc.library.key(),
	];

	return {
		asset: {
			addToLibrary: assetsAndReadiness,
			createFromUploads: assetsAndReadiness,
			save: assetsAndReadiness,
			delete: assetsAndReadiness,
			reprocess: assetsAndReadiness,
			generateMetadata: assetsAndReadiness,
			dismissMetadataSuggestion: () => [
				orpc.asset.key(),
			],
			generateMissingMetadata: assetsAndReadiness,
		},
		assistant: {
			create: () => [
				orpc.assistant.key(),
			],
		},
		block: {
			create: () => [
				orpc.block.key(),
				orpc.library.key(),
			],
			update: () => [
				orpc.block.key(),
				orpc.library.key(),
			],
			// Bot tiles count their blocks.
			delete: () => [
				orpc.block.key(),
				orpc.library.key(),
				orpc.bot.list.key(),
			],
			retryDocument: assetsAndReadiness,
			retryFailed: assetsAndReadiness,
		},
		bot: {
			save: (input) => [
				orpc.bot.key(),
				orpc.library.key(),
				orpc.organization.deletionImpact.key(),
				...(input.listBlockIds ?? []).map((blockId) =>
					orpc.resource.getVisibility.key({
						input: {
							resourceType: "block",
							resourceId: blockId,
						},
					}),
				),
			],
			publish: () => [
				orpc.bot.key(),
				orpc.library.key(),
			],
			setFavourite: () => [
				orpc.bot.key(),
				orpc.library.key(),
			],
			delete: () => [
				orpc.bot.key(),
				orpc.library.key(),
				readOnlyChats,
			],
		},
		botSetup: {
			save: () => [
				orpc.botSetup.key(),
				readOnlyChats,
				orpc.bot.list.key(),
				orpc.library.key(),
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
			pin: () => [
				orpc.chat.key(),
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
		dataExport: {
			request: () => [
				orpc.dataExport.latest.key(),
			],
		},
		health: {
			sendTestEmail: () => [
				orpc.health.instance.key(),
			],
		},
		group: {
			create: () => [
				orpc.group.key(),
				readiness,
			],
			update: () => [
				orpc.group.key(),
				orpc.quota.find.key(),
				readiness,
			],
			delete: () => [
				orpc.group.key(),
				orpc.quota.find.key(),
				readiness,
				readOnlyChats,
				orpc.botSetup.coverage.key(),
			],
			addMembers: groupMembership,
			removeMembers: groupMembership,
		},
		model: {
			create: models,
			update: models,
			delete: models,
			discover: models,
		},
		organization: {
			// The initial admin's account gains a membership.
			create: () => [
				orpc.organization.key(),
				orpc.user.listAll.key(),
				orpc.instance.key(),
			],
			update: () => [
				orpc.organization.key(),
				readiness,
			],
			delete: () => [
				orpc.organization.key(),
			],
			setLogo: logos,
			removeLogo: logos,
		},
		organizationInvitation: {
			create: () => [
				orpc.organizationInvitation.key(),
				readiness,
			],
			update: () => [
				orpc.organizationInvitation.key(),
				readiness,
			],
			delete: () => [
				orpc.organizationInvitation.key(),
				readiness,
			],
			respond: ({ response }) => [
				orpc.organizationInvitation.key(),
				readiness,
				...(response === "accept"
					? [
							orpc.organization.key(),
						]
					: []),
			],
		},
		// Instance admins change memberships of any organisation.
		instance: {
			addMember: instanceMembership,
			changeMemberRole: instanceMembership,
			removeMember: instanceMembership,
			// Readiness counts pending invitations.
			inviteMember: () => [
				orpc.organizationInvitation.key(),
				orpc.instance.key(),
				readiness,
			],
			removeUserImage: pictures,
			removeOrganizationLogo: logos,
		},
		organizationMember: {
			update: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
				orpc.authorization.key(),
				readiness,
			],
			delete: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
				...groupSummaries(),
				readiness,
				readOnlyChats,
			],
		},
		provider: {
			create: () => [
				orpc.provider.key(),
				readiness,
			],
			update: () => [
				orpc.provider.key(),
				readiness,
				orpc.botSetup.key(),
				readOnlyChats,
			],
			// Deleting the web search provider turns the organisation's web search off.
			delete: () => [
				orpc.provider.key(),
				orpc.organization.key(),
				readiness,
				orpc.botSetup.key(),
				readOnlyChats,
				orpc.bot.list.key(),
				orpc.library.key(),
			],
		},
		quota: {
			create: () => [
				orpc.quota.key(),
				readiness,
				orpc.botSetup.coverage.key(),
			],
			update: () => [
				orpc.quota.key(),
				readiness,
				orpc.botSetup.coverage.key(),
			],
			deactivate: () => [
				orpc.quota.key(),
				readiness,
				orpc.botSetup.coverage.key(),
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
				...(input.listBlockIds ?? []).map((blockId) =>
					orpc.resource.getVisibility.key({
						input: {
							resourceType: "block",
							resourceId: blockId,
						},
					}),
				),
				orpc.resource.listingImpact.key(),
				orpc.organization.deletionImpact.key(),
				orpc.user.listAccess.key(),
				readOnlyChats,
			],
		},
		storage: {
			createUploadUrls: () => [
				orpc.storage.key(),
			],
		},
		user: {
			// Deleting accounts removes their memberships.
			delete: () => [
				orpc.user.key(),
				readiness,
				orpc.instance.key(),
			],
			ban: () => [
				orpc.user.key(),
				orpc.instance.key(),
			],
			unban: () => [
				orpc.user.key(),
				orpc.instance.key(),
			],
			resetTwoFactor: () => [
				orpc.user.key(),
				orpc.instance.key(),
			],
			setInstanceRole: () => [
				orpc.user.key(),
				orpc.instance.key(),
			],
			setTourState: () => [
				orpc.user.me.key(),
			],
			setImage: pictures,
			removeImage: pictures,
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
