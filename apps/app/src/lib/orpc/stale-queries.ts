import type { TurnWrite } from "@orcai/schema";
import type { InferClientInputs, InferClientOutputs } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { RouterUtils, RouterUtilsOptions } from "@orpc/tanstack-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
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
	// Its page offers what the user's capabilities on it allow.
	const resourcePage = (resource: Inputs["resource"]["listGrants"]) => {
		switch (resource.resourceType) {
			case "bot":
				return orpc.bot.find.key({
					input: {
						id: resource.resourceId,
					},
				});
			case "block":
				return orpc.block.find.key({
					input: {
						id: resource.resourceId,
					},
				});
			case "asset":
				return orpc.asset.find.key({
					input: {
						id: resource.resourceId,
					},
				});
		}
	};
	const resourceAccess = (resource: Inputs["resource"]["listGrants"]) => {
		const { resourceType, resourceId } = resource;
		const input = {
			resourceType,
			resourceId,
		};

		return [
			resourcePage(resource),
			orpc.resource.listGrants.key({
				input,
			}),
			orpc.resource.listPrincipals.key({
				input,
			}),
			// Items inside it show the access they inherit.
			orpc.resource.inheritedAccess.key(),
			orpc.organizationMember.listAccess.key(),
			readOnlyChats,
			orpc.botSetup.coverage.key(),
			// Chat pickers offer the bots shared with the user.
			orpc.bot.list.key(),
		];
	};
	// Organisation readiness reads providers, models, pools, groups and members.
	const readiness = orpc.readiness.key();
	// So does the model a new chat starts on, with the organisation's default.
	const defaultChatModel = orpc.chat.defaultModel.key();

	// The user's activity lists the work they start and the failures and suggestions it leaves.
	const activity = orpc.activity.key();

	// What the user may read and use follows the grants reaching them, directly or through a group.
	// Sharing lists those grants and the organisation's members.
	const access = () => [
		orpc.bot.key(),
		orpc.block.key(),
		orpc.asset.key(),
		orpc.library.key(),
		orpc.catalogue.key(),
		orpc.resource.key(),
		orpc.chatBlock.key(),
		orpc.botSetup.key(),
		orpc.quota.key(),
		orpc.organizationMember.listAccess.key(),
		readOnlyChats,
		activity,
	];

	// Group lists and quota pools show each group's member count.
	const groupSummaries = () => [
		orpc.group.list.key(),
		orpc.quotaPool.find.key(),
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
		readiness,
		defaultChatModel,
		...access(),
	];

	const instanceMembership = () => [
		orpc.instance.key(),
		orpc.organization.listAll.key(),
		orpc.organization.find.key(),
		orpc.user.listAll.key(),
		orpc.organizationMember.key(),
		readiness,
		...groupSummaries(),
	];

	// Library and catalogue tiles show their creator; an organisation's page counts its entries.
	const libraryLists = () => [
		orpc.bot.list.key(),
		orpc.block.list.key(),
		orpc.asset.list.key(),
		orpc.library.key(),
		orpc.catalogue.key(),
		orpc.organization.profile.key(),
	];
	// Library tiles and item pages show the owner.
	const owners = () => [
		...libraryLists(),
		orpc.bot.find.key(),
		orpc.block.find.key(),
		orpc.asset.find.key(),
	];
	const handedOver = (output: { handedOver: unknown }) =>
		output.handedOver ? owners() : [];
	// Adding from the catalogue changes the library, and removing ends what the organisation built on it.
	const additions = () => [
		...libraryLists(),
		orpc.bot.key(),
		orpc.block.find.key(),
		orpc.botSetup.key(),
		orpc.resource.listGrants.key(),
		orpc.organizationMember.listAccess.key(),
		orpc.resource.listingImpact.key(),
		orpc.organization.deletionImpact.key(),
		readOnlyChats,
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
		defaultChatModel,
		orpc.botSetup.key(),
		readOnlyChats,
		orpc.bot.list.key(),
		orpc.library.key(),
	];

	// Readiness lists each asset's title and state; repository tiles count them.
	const assetsAndReadiness = () => [
		orpc.asset.key(),
		orpc.block.readiness.key(),
		orpc.block.list.key(),
		orpc.library.key(),
		activity,
	];
	// Bots a block or asset write leaves short of the readiness rule move to draft.
	const assetsAndBots = () => [
		...assetsAndReadiness(),
		orpc.bot.key(),
	];

	return {
		asset: {
			addToLibrary: assetsAndReadiness,
			createFromUploads: assetsAndReadiness,
			save: assetsAndReadiness,
			delete: assetsAndBots,
			prepareAgain: assetsAndReadiness,
			generateMetadata: assetsAndReadiness,
			dismissMetadataSuggestion: () => [
				orpc.asset.key(),
				activity,
			],
			generateMissingMetadata: assetsAndReadiness,
		},
		assistant: {
			create: () => [
				orpc.assistant.key(),
			],
		},
		// Saving a repository takes over the uploads made in its editor; deleting it ends their indexing.
		block: {
			create: () => [
				orpc.block.key(),
				orpc.library.key(),
				activity,
			],
			update: () => [
				orpc.block.key(),
				orpc.library.key(),
				orpc.bot.key(),
				activity,
			],
			delete: () => [
				orpc.block.key(),
				orpc.library.key(),
				orpc.bot.key(),
				activity,
			],
			prepareAssetAgain: assetsAndReadiness,
			prepareFailedAgain: assetsAndReadiness,
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
		activity: {
			dismissRun: () => [
				activity,
			],
			dismissFailure: () => [
				activity,
			],
		},
		dataExport: {
			request: () => [
				orpc.dataExport.latest.key(),
				activity,
			],
		},
		health: {
			sendTestEmail: () => [
				orpc.health.instance.key(),
			],
		},
		instanceSettings: {
			updateEmbeddings: () => [
				orpc.instanceSettings.key(),
				orpc.health.instance.key(),
				readiness,
			],
			reembedEmbeddings: () => [
				orpc.instanceSettings.key(),
				orpc.health.instance.key(),
			],
			retryFailedEmbeddings: () => [
				orpc.instanceSettings.embeddingProgress.key(),
				...assetsAndReadiness(),
			],
			prepareAssetsAgain: () => [
				orpc.instanceSettings.embeddingProgress.key(),
				...assetsAndReadiness(),
			],
		},
		group: {
			create: () => [
				orpc.group.key(),
				readiness,
			],
			update: () => [
				orpc.group.key(),
				orpc.quotaPool.find.key(),
				readiness,
			],
			delete: () => [
				orpc.group.key(),
				orpc.quotaPool.find.key(),
				readiness,
				defaultChatModel,
				...access(),
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
				defaultChatModel,
			],
			// Bots elsewhere that used its blocks may have moved to draft.
			delete: () => [
				orpc.organization.key(),
				orpc.bot.key(),
				orpc.library.key(),
				activity,
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
		// Instance admins change memberships of any organisation, their own included.
		instance: {
			addMember: () => [
				...instanceMembership(),
				...access(),
			],
			changeMemberRole: (_input, output) => [
				...instanceMembership(),
				...handedOver(output),
			],
			removeMember: (_input, output) => [
				...instanceMembership(),
				...access(),
				...handedOver(output),
			],
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
			update: (_input, output) => [
				orpc.organizationMember.key(),
				orpc.authorization.key(),
				readiness,
				...handedOver(output),
			],
			// The actor may be the member who leaves, losing what reached them there.
			delete: (_input, output) => [
				orpc.user.listAll.key(),
				orpc.organizationMember.key(),
				orpc.organization.find.key(),
				...groupSummaries(),
				readiness,
				...access(),
				...handedOver(output),
			],
		},
		catalogue: {
			add: additions,
			addBlocks: additions,
			remove: additions,
		},
		provider: {
			create: () => [
				orpc.provider.key(),
				readiness,
			],
			update: () => [
				orpc.provider.key(),
				readiness,
				defaultChatModel,
				orpc.botSetup.key(),
				readOnlyChats,
			],
			// Deleting the web search provider turns the organisation's web search off.
			delete: () => [
				orpc.provider.key(),
				orpc.organization.key(),
				readiness,
				defaultChatModel,
				orpc.botSetup.key(),
				readOnlyChats,
				orpc.bot.list.key(),
				orpc.library.key(),
			],
		},
		quotaPool: {
			create: () => [
				orpc.quotaPool.key(),
				orpc.quota.key(),
				readiness,
				defaultChatModel,
				orpc.botSetup.coverage.key(),
			],
			update: () => [
				orpc.quotaPool.key(),
				orpc.quota.key(),
				readiness,
				defaultChatModel,
				orpc.botSetup.coverage.key(),
			],
			deactivate: () => [
				orpc.quotaPool.key(),
				orpc.quota.key(),
				readiness,
				defaultChatModel,
				orpc.botSetup.coverage.key(),
			],
		},
		resource: {
			grant: resourceAccess,
			revoke: resourceAccess,
			// The previous owner keeps Can manage.
			handOver: (input) => [
				...resourceAccess(input),
				...owners(),
			],
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
				// Items inside it show a public ancestor.
				orpc.resource.inheritedAccess.key(),
				orpc.organization.deletionImpact.key(),
				orpc.organizationMember.listAccess.key(),
				orpc.catalogue.key(),
				orpc.organization.profile.key(),
				readOnlyChats,
			],
		},
		storage: {
			createUploadUrls: () => [
				orpc.storage.key(),
			],
		},
		user: {
			// Deleting accounts removes their memberships and hands over what they own.
			delete: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
				orpc.organization.find.key(),
				readiness,
				orpc.instance.key(),
				...owners(),
			],
			ban: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
				orpc.instance.key(),
			],
			unban: () => [
				orpc.user.key(),
				orpc.organizationMember.key(),
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

type StaleKeysOf = (input: unknown, output: unknown) => readonly QueryKey[];

const staleKeysOf = (
	staleQueries: StaleQueries,
	[namespace = "", procedure = ""]: readonly string[],
) =>
	(
		staleQueries as Record<
			string,
			Record<string, StaleKeysOf | undefined> | undefined
		>
	)[namespace]?.[procedure];

/**
 * Marks a query stale and reads it again wherever it is shown. A first read
 * still loading may predate the change and would clear the mark when it
 * lands, so its key is marked again once it settles, without waiting for it.
 */
export const invalidateQuery = (client: QueryClient, queryKey: QueryKey) => {
	const firstReads = client.getQueryCache().findAll({
		queryKey,
		predicate: (query) =>
			query.state.fetchStatus !== "idle" && query.state.data === undefined,
	});

	for (const query of firstReads) {
		void query.promise
			?.catch(() => undefined)
			.then(() =>
				client.invalidateQueries({
					queryKey: query.queryKey,
					exact: true,
				}),
			);
	}

	return client.invalidateQueries({
		queryKey,
	});
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

		for (const queryKey of staleKeysOf(staleQueries, path)?.(input, output) ??
			[]) {
			void invalidateQuery(fnContext.client, queryKey);
		}

		return output;
	};
};

/** The queries an Assistant turn's writes made stale. A write carries the input and output fields its entry reads. */
export const staleQueriesOfWrites = (
	orpc: AppUtils,
	writes: readonly TurnWrite[],
): QueryKey[] => {
	const staleQueries = staleQueriesOf(orpc);

	return writes.flatMap(
		(write) =>
			staleKeysOf(staleQueries, write.path.split("."))?.(write, write) ?? [],
	);
};
