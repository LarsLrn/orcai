import { describe, expect, test } from "bun:test";
import type { GroupId, UserId } from "@orcai/core";
import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import {
	createTanstackQueryUtils,
	type RouterUtils,
} from "@orpc/tanstack-query";
import {
	MutationObserver,
	QueryClient,
	type QueryKey,
} from "@tanstack/react-query";
import type { router } from "./router";
import { invalidateStaleQueries } from "./stale-queries";

type AppClient = RouterClient<typeof router>;

const groupA = "group-a" as GroupId;
const groupB = "group-b" as GroupId;
const userId = "user-1" as UserId;

const setup = (call: () => Promise<unknown> = () => Promise.resolve({})) => {
	const client = createORPCClient<AppClient>({
		call,
	});
	const orpc: RouterUtils<AppClient> = createTanstackQueryUtils(client, {
		mutationInterceptors: [
			invalidateStaleQueries(() => orpc),
		],
	});
	const queryClient = new QueryClient();

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
			orpc.user.listAccess.queryKey({
				input: {
					id: userId,
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
		]).toEqual([
			true,
			true,
			true,
			false,
			false,
		]);
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
			orpc.user.find.queryKey({
				input: {
					id: userId,
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
