import { describe, expect, test } from "bun:test";
import {
	keepPreviousData,
	QueryClient,
	QueryObserver,
} from "@tanstack/react-query";
import { openAfterOrganizationSwitch } from "./organization-switch";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A server whose answers depend on the session's active organisation. */
const organisations = () => {
	const server = {
		active: "Org A",
		fetches: 0,
	};
	// The session, not the key, carries the organisation, as in the app.
	const listAssets = () => {
		server.fetches += 1;
		return Promise.resolve(`${server.active} assets`);
	};
	return {
		server,
		assets: {
			queryKey: [
				"asset",
				"list",
				{
					review: true,
				},
			],
			queryFn: listAssets,
			// As the app sets them for asset lists.
			staleTime: 60_000,
			placeholderData: keepPreviousData,
		},
	};
};

describe("openAfterOrganizationSwitch", () => {
	test("a page that stays mounted on the same URL shows the new organisation, never the old one", async () => {
		const queryClient = new QueryClient();
		const { server, assets } = organisations();
		const page = new QueryObserver(queryClient, assets);
		const shown: unknown[] = [];
		const stop = page.subscribe((result) => shown.push(result.data));
		await settle();
		expect(page.getCurrentResult().data).toBe("Org A assets");

		server.active = "Org B";
		shown.length = 0;
		await openAfterOrganizationSwitch(queryClient, {
			refetchSession: async () => undefined,
			navigate: async () => undefined,
		});
		await settle();

		expect(page.getCurrentResult().data).toBe("Org B assets");
		expect(shown).not.toContain("Org A assets");
		stop();
	});

	test("drops inactive queries before navigating, and leaves the ones the new page loaded alone", async () => {
		const queryClient = new QueryClient();
		const { server, assets } = organisations();
		await queryClient.prefetchQuery(assets);
		server.active = "Org B";

		let shown = (): unknown => undefined;
		await openAfterOrganizationSwitch(queryClient, {
			refetchSession: async () => undefined,
			navigate: async () => {
				expect(queryClient.getQueryData(assets.queryKey)).toBeUndefined();
				// The new page's loader fetches, then the page mounts.
				await queryClient.ensureQueryData(assets);
				const page = new QueryObserver(queryClient, assets);
				page.subscribe(() => undefined);
				shown = () => page.getCurrentResult().data;
			},
		});
		await settle();

		expect(shown()).toBe("Org B assets");
		expect(server.fetches).toBe(2);
	});

	test("a page that unmounts during the navigation leaves nothing of the old organisation behind", async () => {
		const queryClient = new QueryClient();
		const { server, assets } = organisations();
		const leaving = new QueryObserver(queryClient, assets);
		const stop = leaving.subscribe(() => undefined);
		await settle();
		server.active = "Org B";

		await openAfterOrganizationSwitch(queryClient, {
			refetchSession: async () => undefined,
			navigate: () => {
				stop();
				return Promise.resolve();
			},
		});
		await settle();
		expect(queryClient.getQueryData(assets.queryKey)).toBeUndefined();

		// Opening the page later in the new organisation fetches it.
		expect(await queryClient.ensureQueryData(assets)).toBe("Org B assets");
	});
});
