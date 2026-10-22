import { describe, expect, mock, test } from "bun:test";

mock.module("@/lib/auth/auth", () => ({
	auth: {},
}));
mock.module("@/lib/effect/runtime", () => ({
	runPromise: () => Promise.reject(new Error("not in unit tests")),
}));

const { Route } = await import("./__root");

type HeadContext = Parameters<NonNullable<typeof Route.options.head>>[0];

const scriptsFor = async (
	loaderData: HeadContext["loaderData"],
): Promise<unknown> =>
	(
		await Route.options.head?.({
			loaderData,
		} as HeadContext)
	)?.scripts;

describe("root head", () => {
	test("loads the Umami script when it is configured", async () => {
		expect(
			await scriptsFor({
				umami: {
					scriptUrl: "https://umami.example.org/script.js",
					websiteId: "site",
				},
			}),
		).toEqual([
			{
				src: "https://umami.example.org/script.js",
				defer: true,
				"data-website-id": "site",
			},
		]);
	});

	test("has no script without Umami", async () => {
		expect(await scriptsFor({})).toEqual([]);
	});
});
