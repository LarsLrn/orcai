import { describe, expect, test } from "bun:test";
import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	ModelId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import type { ResourceIdentity } from "@orcai/schema";
import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import {
	createTanstackQueryUtils,
	type RouterUtils,
} from "@orpc/tanstack-query";
import {
	MutationObserver,
	type MutationObserverOptions,
	onlineManager,
	QueryClient,
	type QueryKey,
	QueryObserver,
} from "@tanstack/react-query";
import type { router } from "./router";
import {
	invalidateQuery,
	invalidateStaleQueries,
	staleQueriesOfWrites,
} from "./stale-queries";

type AppClient = RouterClient<typeof router>;

const groupA = "group-a" as GroupId;
const groupB = "group-b" as GroupId;
const userId = "user-1" as UserId;

/** Runs a mutation with an input its stale queries do not read. */
const mutateUnread = <Data, Failure, Variables, Context>(
	queryClient: QueryClient,
	options: MutationObserverOptions<Data, Failure, Variables, Context>,
) =>
	new MutationObserver<Data, Failure, Variables, Context>(
		queryClient,
		options,
	).mutate({} as Variables);

const setup = (
	call: (path: readonly string[]) => Promise<unknown> = () =>
		Promise.resolve({}),
) => {
	const client = createORPCClient<AppClient>({
		call,
	});
	const orpc: RouterUtils<AppClient> = createTanstackQueryUtils(client, {
		mutationInterceptors: [
			invalidateStaleQueries(() => orpc),
		],
	});
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60_000,
			},
		},
	});

	return {
		orpc,
		queryClient,
		/** Caches a query and reports whether it has since been invalidated. */
		cached: (queryKey: QueryKey) => {
			queryClient.setQueryData(queryKey, {});

			return () => queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
		},
	};
};

describe("invalidateStaleQueries", () => {
	test("invalidates what the mutation made stale and nothing else", async () => {
		const { orpc, queryClient, cached } = setup();
		const membersA = cached(
			orpc.group.listMembers.queryKey({
				input: {
					groupId: groupA,
				},
			}),
		);
		const candidatesA = cached(
			orpc.group.listCandidates.queryKey({
				input: {
					groupId: groupA,
				},
			}),
		);
		const access = cached(
			orpc.organizationMember.listAccess.queryKey({
				input: {
					userId,
				},
			}),
		);
		const membersB = cached(
			orpc.group.listMembers.queryKey({
				input: {
					groupId: groupB,
				},
			}),
		);
		const groups = cached(
			orpc.group.list.queryKey({
				input: {},
			}),
		);
		const models = cached(
			orpc.model.list.queryKey({
				input: {},
			}),
		);

		await new MutationObserver(
			queryClient,
			orpc.group.addMembers.mutationOptions(),
		).mutate({
			groupId: groupA,
			userIds: [
				userId,
			],
		});

		expect([
			membersA(),
			candidatesA(),
			access(),
			membersB(),
			groups(),
			models(),
		]).toEqual([
			true,
			true,
			true,
			false,
			true,
			false,
		]);
	});

	test("makes organisation readiness stale on every configuration edit", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() => mutateUnread(queryClient, orpc.provider.update.mutationOptions()),
			() => mutateUnread(queryClient, orpc.model.update.mutationOptions()),
			() => mutateUnread(queryClient, orpc.quotaPool.create.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.organization.update.mutationOptions()),
			() =>
				new MutationObserver(
					queryClient,
					orpc.group.addMembers.mutationOptions(),
				).mutate({
					groupId: groupA,
					userIds: [
						userId,
					],
				}),
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationMember.delete.mutationOptions(),
				),
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationInvitation.create.mutationOptions(),
				),
			() => mutateUnread(queryClient, orpc.user.delete.mutationOptions()),
		];

		for (const edit of edits) {
			const readiness = cached(
				orpc.readiness.organization.queryKey({
					input: {},
				}),
			);
			await edit();
			expect(readiness()).toBe(true);
		}
	});

	test("refreshes the organisation's member count when members come or go", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationMember.delete.mutationOptions(),
				),
			() =>
				new MutationObserver(
					queryClient,
					orpc.organizationInvitation.respond.mutationOptions(),
				).mutate({
					id: crypto.randomUUID(),
					response: "accept",
				}),
			() =>
				mutateUnread(queryClient, orpc.instance.addMember.mutationOptions()),
			() => mutateUnread(queryClient, orpc.user.delete.mutationOptions()),
		];

		for (const edit of edits) {
			const organization = cached(
				orpc.organization.find.queryKey({
					input: {
						id: "organization-1" as OrganizationId,
					},
				}),
			);
			await edit();
			expect(organization()).toBe(true);
		}
	});

	test("makes the user's activity stale whenever they start, hand over or clear work", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() =>
				mutateUnread(
					queryClient,
					orpc.asset.createFromUploads.mutationOptions(),
				),
			() =>
				mutateUnread(queryClient, orpc.asset.prepareAgain.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.asset.generateMissingMetadata.mutationOptions(),
				),
			() =>
				mutateUnread(
					queryClient,
					orpc.asset.dismissMetadataSuggestion.mutationOptions(),
				),
			() => mutateUnread(queryClient, orpc.asset.delete.mutationOptions()),
			() => mutateUnread(queryClient, orpc.block.update.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.block.prepareFailedAgain.mutationOptions(),
				),
			() => mutateUnread(queryClient, orpc.block.delete.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.dataExport.request.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.activity.dismissRun.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.activity.dismissFailure.mutationOptions(),
				),
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationMember.delete.mutationOptions(),
				),
		];

		for (const edit of edits) {
			const summary = cached(
				orpc.activity.summary.queryKey({
					input: {},
				}),
			);
			await edit();
			expect(summary()).toBe(true);
		}
	});

	test("makes open chats stale whenever access to their bot or organisation changes", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() => mutateUnread(queryClient, orpc.resource.grant.mutationOptions()),
			() => mutateUnread(queryClient, orpc.resource.revoke.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.resource.setVisibility.mutationOptions(),
				),
			() => mutateUnread(queryClient, orpc.group.addMembers.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.group.removeMembers.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationMember.delete.mutationOptions(),
				),
			() => mutateUnread(queryClient, orpc.bot.delete.mutationOptions()),
		];

		for (const edit of edits) {
			const chat = cached(
				orpc.chat.find.queryKey({
					input: {
						id: crypto.randomUUID() as ChatId,
					},
				}),
			);
			await edit();
			expect(chat()).toBe(true);
		}
	});

	test("a grant or revoke makes the resource's page stale, not other resources' pages", async () => {
		const { orpc, queryClient, cached } = setup();
		const botId = "bot-1" as BotId;
		const blockId = "block-1" as BlockId;
		const assetId = "asset-1" as AssetId;
		const group = {
			principalType: "group",
			principalId: groupA,
		} as const;
		const changes = [
			(resource: ResourceIdentity) =>
				new MutationObserver(
					queryClient,
					orpc.resource.grant.mutationOptions(),
				).mutate({
					...resource,
					principals: [
						group,
					],
					role: "viewer",
				}),
			(resource: ResourceIdentity) =>
				new MutationObserver(
					queryClient,
					orpc.resource.revoke.mutationOptions(),
				).mutate({
					...resource,
					...group,
				}),
		];

		for (const change of changes) {
			for (const resource of [
				{
					resourceType: "bot",
					resourceId: botId,
				},
				{
					resourceType: "block",
					resourceId: blockId,
				},
				{
					resourceType: "asset",
					resourceId: assetId,
				},
			] as const) {
				const bot = cached(
					orpc.bot.find.queryKey({
						input: {
							id: botId,
						},
					}),
				);
				const otherBot = cached(
					orpc.bot.find.queryKey({
						input: {
							id: "bot-2" as BotId,
						},
					}),
				);
				const block = cached(
					orpc.block.find.queryKey({
						input: {
							id: blockId,
						},
					}),
				);
				const asset = cached(
					orpc.asset.find.queryKey({
						input: {
							id: assetId,
						},
					}),
				);
				await change(resource);
				expect({
					bot: bot(),
					otherBot: otherBot(),
					block: block(),
					asset: asset(),
				}).toEqual({
					bot: resource.resourceType === "bot",
					otherBot: false,
					block: resource.resourceType === "block",
					asset: resource.resourceType === "asset",
				});
			}
		}
	});

	test("an instance invitation makes both readiness views stale", async () => {
		const { orpc, queryClient, cached } = setup();
		const organizationId = "organization-1" as OrganizationId;
		const instanceReadiness = cached(
			orpc.instance.organizationReadiness.queryKey({
				input: {
					organizationId,
				},
			}),
		);
		const readiness = cached(
			orpc.readiness.organization.queryKey({
				input: {},
			}),
		);

		await new MutationObserver(
			queryClient,
			orpc.instance.inviteMember.mutationOptions(),
		).mutate({
			organizationId,
			email: "new@example.test",
			role: "member",
		});

		expect([
			instanceReadiness(),
			readiness(),
		]).toEqual([
			true,
			true,
		]);
	});

	test("makes bot setup coverage stale whenever group membership changes", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() => mutateUnread(queryClient, orpc.group.addMembers.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.group.removeMembers.mutationOptions()),
			() => mutateUnread(queryClient, orpc.group.delete.mutationOptions()),
		];

		for (const edit of edits) {
			const coverage = cached(
				orpc.botSetup.coverage.queryKey({
					input: {
						botId: crypto.randomUUID() as BotId,
						modelId: crypto.randomUUID() as ModelId,
					},
				}),
			);
			await edit();
			expect(coverage()).toBe(true);
		}
	});

	test("makes what the user may read and use stale whenever group or organisation membership changes, the actor's own included", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() => mutateUnread(queryClient, orpc.group.addMembers.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.group.removeMembers.mutationOptions()),
			() => mutateUnread(queryClient, orpc.group.delete.mutationOptions()),
			() =>
				mutateUnread(
					queryClient,
					orpc.organizationMember.delete.mutationOptions(),
				),
			() =>
				mutateUnread(queryClient, orpc.instance.addMember.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.instance.removeMember.mutationOptions()),
		];
		const resource = {
			resourceType: "block",
			resourceId: crypto.randomUUID() as BlockId,
		} as const;

		for (const edit of edits) {
			const reads = [
				cached(
					orpc.bot.find.queryKey({
						input: {
							id: crypto.randomUUID() as BotId,
						},
					}),
				),
				cached(
					orpc.block.find.queryKey({
						input: {
							id: resource.resourceId,
						},
					}),
				),
				cached(
					orpc.asset.find.queryKey({
						input: {
							id: crypto.randomUUID() as AssetId,
						},
					}),
				),
				cached(
					orpc.bot.list.queryKey({
						input: {},
					}),
				),
				cached(
					orpc.library.overview.queryKey({
						input: {},
					}),
				),
				cached(
					orpc.catalogue.list.queryKey({
						input: {},
					}),
				),
				cached(
					orpc.resource.listGrants.queryKey({
						input: resource,
					}),
				),
				cached(
					orpc.chatBlock.list.queryKey({
						input: {
							chatId: crypto.randomUUID() as ChatId,
						},
					}),
				),
				cached(
					orpc.quota.status.queryKey({
						input: {
							providerId: "provider-1",
							modelId: "model-1",
						},
					}),
				),
			];
			const models = cached(
				orpc.model.list.queryKey({
					input: {},
				}),
			);
			await edit();
			expect(reads.map((read) => read())).toEqual(reads.map(() => true));
			expect(models()).toBe(false);
		}
	});

	test("access and listing changes make what items inside the resource inherit stale", async () => {
		const { orpc, queryClient, cached } = setup();
		const bot = {
			resourceType: "bot",
			resourceId: "bot-1" as BotId,
		} as const;
		const group = {
			principalType: "group",
			principalId: groupA,
		} as const;
		const edits = [
			() =>
				new MutationObserver(
					queryClient,
					orpc.resource.grant.mutationOptions(),
				).mutate({
					...bot,
					principals: [
						group,
					],
					role: "viewer",
				}),
			() =>
				new MutationObserver(
					queryClient,
					orpc.resource.revoke.mutationOptions(),
				).mutate({
					...bot,
					...group,
				}),
			() =>
				new MutationObserver(
					queryClient,
					orpc.resource.setVisibility.mutationOptions(),
				).mutate({
					...bot,
					visibility: "public",
				}),
		];

		for (const edit of edits) {
			const inherited = cached(
				orpc.resource.inheritedAccess.queryKey({
					input: {
						resourceType: "block",
						resourceId: crypto.randomUUID() as BlockId,
					},
				}),
			);
			const models = cached(
				orpc.model.list.queryKey({
					input: {},
				}),
			);
			await edit();
			expect([
				inherited(),
				models(),
			]).toEqual([
				true,
				false,
			]);
		}
	});

	test("makes bot setups and their chats stale whenever a model can change", async () => {
		const { orpc, queryClient, cached } = setup();
		const edits = [
			() => mutateUnread(queryClient, orpc.provider.update.mutationOptions()),
			() => mutateUnread(queryClient, orpc.provider.delete.mutationOptions()),
			() => mutateUnread(queryClient, orpc.model.update.mutationOptions()),
			() => mutateUnread(queryClient, orpc.model.delete.mutationOptions()),
		];

		for (const edit of edits) {
			const botSetup = cached(
				orpc.botSetup.find.queryKey({
					input: {
						botId: crypto.randomUUID() as BotId,
					},
				}),
			);
			const chat = cached(
				orpc.chat.find.queryKey({
					input: {
						id: crypto.randomUUID() as ChatId,
					},
				}),
			);
			await edit();
			expect([
				botSetup(),
				chat(),
			]).toEqual([
				true,
				true,
			]);
		}
	});

	test("invalidates before the call site's onSuccess, which cannot replace it", async () => {
		const { orpc, queryClient, cached } = setup();
		const me = cached(
			orpc.user.me.queryKey({
				input: {},
			}),
		);
		let staleOnSuccess: boolean | undefined;

		await new MutationObserver(
			queryClient,
			orpc.user.setTourState.mutationOptions({
				onSuccess: () => {
					staleOnSuccess = me();
				},
			}),
		).mutate({
			tourId: "initialTour",
			state: "completed",
		});

		expect(staleOnSuccess).toBe(true);
	});

	test("scopes the tour state to the user's own record", async () => {
		const { orpc, queryClient, cached } = setup();
		const someone = cached(
			orpc.organizationMember.find.queryKey({
				input: {
					userId,
				},
			}),
		);

		await new MutationObserver(
			queryClient,
			orpc.user.setTourState.mutationOptions(),
		).mutate({
			tourId: "initialTour",
			state: "skipped",
		});

		expect(someone()).toBe(false);
	});

	test("a failed mutation invalidates nothing", async () => {
		const { orpc, queryClient, cached } = setup(() =>
			Promise.reject(new Error("rejected")),
		);
		const members = cached(
			orpc.group.listMembers.queryKey({
				input: {
					groupId: groupA,
				},
			}),
		);

		await new MutationObserver(
			queryClient,
			orpc.group.removeMembers.mutationOptions(),
		)
			.mutate({
				groupId: groupA,
				userIds: [
					userId,
				],
			})
			.catch(() => undefined);

		expect(members()).toBe(false);
	});
});

describe("invalidateQuery", () => {
	/** A bot whose first read waits for `answerFirst`; later reads answer `read <n>`. */
	const botReads = () => {
		const first = Promise.withResolvers<unknown>();
		let reads = 0;
		const { orpc, queryClient } = setup((path) => {
			if (path.join(".") !== "bot.find") {
				return Promise.resolve({});
			}
			reads += 1;

			return reads === 1 ? first.promise : Promise.resolve(`read ${reads}`);
		});
		const bot = orpc.bot.find.queryOptions({
			input: {
				id: "bot-1" as BotId,
			},
		});
		const query = () =>
			queryClient.getQueryCache().find({
				queryKey: bot.queryKey,
			});

		return {
			queryClient,
			queryKey: bot.queryKey,
			data: () => query()?.state.data,
			fetchStatus: () => query()?.state.fetchStatus,
			show: () =>
				new QueryObserver(queryClient, bot).subscribe(() => undefined),
			loadFirstRead: () => queryClient.ensureQueryData(bot),
			answerFirst: first.resolve,
			reads: () => reads,
		};
	};

	/** Waits for later tasks, such as a read's follow-up, to run. */
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	test("a shown first read still loading when the change lands is read again once it settles", async () => {
		const bot = botReads();
		const unsubscribe = bot.show();

		const invalidated = invalidateQuery(bot.queryClient, bot.queryKey);
		bot.answerFirst("before the change");
		await invalidated;
		await settle();
		unsubscribe();

		expect(bot.data()).toBe("read 2");
	});

	test("a loader's first read still loading when the change lands is read again on mount", async () => {
		const bot = botReads();
		const loaded: Promise<unknown> = bot.loadFirstRead();

		await invalidateQuery(bot.queryClient, bot.queryKey);
		bot.answerFirst("before the change");
		expect(await loaded).toBe("before the change");
		await settle();
		const unsubscribe = bot.show();
		await settle();
		unsubscribe();

		expect(bot.data()).toBe("read 2");
	});

	test("a paused first read does not hold the caller and is read again once it resumes", async () => {
		const bot = botReads();
		bot.queryClient.mount();
		onlineManager.setOnline(false);
		try {
			const unsubscribe = bot.show();

			await invalidateQuery(bot.queryClient, bot.queryKey);
			expect(bot.fetchStatus()).toBe("paused");

			onlineManager.setOnline(true);
			bot.answerFirst("before the change");
			await settle();
			unsubscribe();
		} finally {
			onlineManager.setOnline(true);
			bot.queryClient.unmount();
		}

		expect(bot.data()).toBe("read 2");
	});

	test("callers holding the first read get its answer, not an error", async () => {
		const bot = botReads();
		const unsubscribe = bot.show();
		const joined: Promise<unknown> = bot.loadFirstRead();
		const captured = bot.queryClient.getQueryCache().find({
			queryKey: bot.queryKey,
		})?.promise;

		const invalidated = invalidateQuery(bot.queryClient, bot.queryKey);
		bot.answerFirst("before the change");
		await invalidated;
		await settle();
		unsubscribe();

		expect(await joined).toBe("before the change");
		expect(await captured).toBe("before the change");
	});

	test("a query with data is read once more", async () => {
		const bot = botReads();
		const unsubscribe = bot.show();
		bot.answerFirst("first");
		await bot.loadFirstRead();

		await invalidateQuery(bot.queryClient, bot.queryKey);
		unsubscribe();

		expect([
			bot.data(),
			bot.reads(),
		]).toEqual([
			"read 2",
			2,
		]);
	});
});

describe("staleQueriesOfWrites", () => {
	test("makes stale what the same mutations would, from the fields a write carries", async () => {
		const { orpc, queryClient, cached } = setup();
		const membersA = cached(
			orpc.group.listMembers.queryKey({
				input: {
					groupId: groupA,
				},
			}),
		);
		const membersB = cached(
			orpc.group.listMembers.queryKey({
				input: {
					groupId: groupB,
				},
			}),
		);
		const library = cached(
			orpc.library.counts.queryKey({
				input: {},
			}),
		);
		const catalogue = cached(
			orpc.catalogue.list.queryKey({
				input: {},
			}),
		);
		const models = cached(
			orpc.model.list.queryKey({
				input: {},
			}),
		);

		const invalidate = (writes: Parameters<typeof staleQueriesOfWrites>[1]) =>
			Promise.all(
				staleQueriesOfWrites(orpc, writes).map((queryKey) =>
					queryClient.invalidateQueries({
						queryKey,
					}),
				),
			);
		await invalidate([
			{
				path: "group.addMembers",
				groupId: groupA,
			},
			{
				path: "catalogue.add",
			},
			{
				path: "organizationMember.delete",
				handedOver: false,
			},
		]);

		expect(membersA()).toBe(true);
		expect(membersB()).toBe(false);
		expect(library()).toBe(true);
		expect(catalogue()).toBe(true);
		expect(models()).toBe(false);
	});

	test("a role change makes owners stale only when it handed something over", async () => {
		const { orpc, queryClient, cached } = setup();
		const botPage = cached(
			orpc.bot.find.queryKey({
				input: {
					id: "bot-1" as BotId,
				},
			}),
		);
		const invalidate = (handedOver: boolean) =>
			Promise.all(
				staleQueriesOfWrites(orpc, [
					{
						path: "organizationMember.update",
						handedOver,
					},
				]).map((queryKey) =>
					queryClient.invalidateQueries({
						queryKey,
					}),
				),
			);

		await invalidate(false);
		expect(botPage()).toBe(false);

		await invalidate(true);
		expect(botPage()).toBe(true);
	});

	test("block, asset and organisation deletions make bot pages stale, since they can move bots to draft", async () => {
		const { orpc, queryClient, cached } = setup();
		const writes = [
			() => mutateUnread(queryClient, orpc.block.update.mutationOptions()),
			() => mutateUnread(queryClient, orpc.block.delete.mutationOptions()),
			() => mutateUnread(queryClient, orpc.asset.delete.mutationOptions()),
			() =>
				mutateUnread(queryClient, orpc.organization.delete.mutationOptions()),
			() => mutateUnread(queryClient, orpc.catalogue.remove.mutationOptions()),
		];

		for (const write of writes) {
			const botPage = cached(
				orpc.bot.find.queryKey({
					input: {
						id: "bot-1" as BotId,
					},
				}),
			);
			await write();
			expect(botPage()).toBe(true);
		}
	});
});
