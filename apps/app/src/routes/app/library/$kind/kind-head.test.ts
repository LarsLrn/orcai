import { describe, expect, mock, spyOn, test } from "bun:test";
import {
	type AnyRoute,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

mock.module("@/lib/auth/auth", () => ({
	auth: {},
}));
mock.module("@/lib/effect/runtime", () => ({
	runPromise: () => Promise.reject(new Error("not in unit tests")),
}));
mock.module("@/lib/auth/auth-client", () => ({
	authClient: {},
}));
mock.module("@/lib/orpc/orpc", () => scriptedOrpc());

const { Route } = await import("./route");

/** The kind route's title at a path, through a router that holds only it. */
const titleAt = async (path: string) => {
	const { params, head }: AnyRoute["options"] = Route.options;
	const root = createRootRoute();
	const kind = createRoute({
		getParentRoute: () => root,
		path: "$kind",
		params,
		head,
	});
	const router = createRouter({
		routeTree: root.addChildren([
			kind,
		]),
		history: createMemoryHistory({
			initialEntries: [
				path,
			],
		}),
	});
	await router.load();
	const match = router.state.matches.at(-1);
	return {
		status: match?.status,
		title: match?.meta?.find((entry) => entry?.title)?.title,
	};
};

describe("library kind head", () => {
	test("names the kind of a known slug", async () => {
		expect(await titleAt("/behaviours")).toEqual({
			status: "success",
			title: "Behaviours",
		});
	});

	test("an unknown slug is not found, without a title or an error", async () => {
		const errors = spyOn(console, "error");
		expect(await titleAt("/bots")).toEqual({
			status: "notFound",
			title: undefined,
		});
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
	});
});
