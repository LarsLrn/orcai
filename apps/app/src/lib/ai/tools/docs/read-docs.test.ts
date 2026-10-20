import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import {
	type DocsFetch,
	docsMarkdownPath,
	docsPageTitle,
	readDocs,
} from "./read-docs";

const INDEX = `# OrcAI

- [Bots](/docs/using-orcai/bots): Create and publish bots.
`;
const BOTS = `# Bots (/docs/using-orcai/bots)

Bots live in the Library.
`;

let requested: string[] = [];
let arrived: ((signal: AbortSignal) => void) | undefined;

const ORIGIN = "http://web:3001";

const markdown = (body: string) =>
	new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});

/** The docs site as `readDocs` sees it, without a server. */
const fakeFetch: DocsFetch = async (url, init) => {
	const target = new URL(url);

	if (target.origin !== ORIGIN) {
		throw new TypeError("fetch failed");
	}

	requested.push(target.pathname);

	switch (target.pathname) {
		case "/llms.txt":
			return new Response(INDEX, {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
				},
			});
		case "/docs/index.md":
			return markdown("# Introduction (/docs)\n\nWelcome.");
		case "/docs/using-orcai.md":
			return markdown("# Using OrcAI (/docs/using-orcai)\n\nPages.");
		case "/docs/using-orcai/bots.md":
			return markdown(BOTS);
		case "/docs/html.md":
			return new Response("<html></html>", {
				headers: {
					"Content-Type": "text/html",
				},
			});
		case "/docs/binary.md":
			return new Response("# Binary (/docs/binary)", {
				headers: {
					"Content-Type": "application/octet-stream",
				},
			});
		case "/docs/broken.md":
			return new Response("boom", {
				status: 500,
			});
		case "/docs/moved.md":
			if (init.redirect === "error") {
				throw new TypeError("unexpected redirect");
			}
			return markdown("# Elsewhere (/docs/elsewhere)");
		case "/docs/slow.md":
			return await new Promise<Response>((_resolve, reject) => {
				init.signal?.addEventListener("abort", () => {
					reject(init.signal?.reason);
				});
				if (init.signal) {
					arrived?.(init.signal);
				}
			});
		default:
			return new Response("Not found", {
				status: 404,
			});
	}
};

const docs = {
	publicOrigin: "https://docs.example.org",
	fetchOrigin: ORIGIN,
};

beforeEach(() => {
	requested = [];
	arrived = undefined;
});

const failure = (path: string) =>
	Effect.runPromise(
		Effect.flip(
			readDocs({
				fetch: fakeFetch,
				docs,
				path,
			}),
		),
	);

describe("docsMarkdownPath", () => {
	test("maps /docs to the index page", () => {
		expect(docsMarkdownPath("/docs")).toEqual({
			path: "/docs",
			fetchPath: "/docs/index.md",
		});
	});

	test("maps folder and page paths to their Markdown", () => {
		expect(docsMarkdownPath("/docs/using-orcai")?.fetchPath).toBe(
			"/docs/using-orcai.md",
		);
		expect(docsMarkdownPath("/docs/using-orcai/bots")?.fetchPath).toBe(
			"/docs/using-orcai/bots.md",
		);
	});

	test("strips one trailing slash or .md", () => {
		expect(docsMarkdownPath("/docs/using-orcai/bots/")?.path).toBe(
			"/docs/using-orcai/bots",
		);
		expect(docsMarkdownPath("/docs/using-orcai/bots.md")?.path).toBe(
			"/docs/using-orcai/bots",
		);
		expect(docsMarkdownPath("/docs/")?.path).toBe("/docs");
		expect(docsMarkdownPath("/docs/using-orcai/bots//")).toBeUndefined();
		expect(docsMarkdownPath("/docs/using-orcai/bots.md/")).toBeUndefined();
	});

	test.each([
		"",
		"/",
		"docs/using-orcai",
		"/docs/../app",
		"/docs/using-orcai/../../app",
		"/docs/Bots",
		"/docs/using_orcai",
		"/docs/using-orcai/bots?x=1",
		"/docs/using-orcai/bots#top",
		"/docs//bots",
		"/docs/-bots",
		"/docs/bots-",
		"/llms.txt",
		"https://docs.example.org/docs/using-orcai/bots",
		"//evil.example/docs",
		"/docsx",
	])("rejects %p", (path) => {
		expect(docsMarkdownPath(path)).toBeUndefined();
	});
});

describe("docsPageTitle", () => {
	test("reads the title from the first line", () => {
		expect(docsPageTitle(BOTS)).toBe("Bots");
		expect(docsPageTitle("# Roles (and limits) (/docs/a)\n")).toBe(
			"Roles (and limits)",
		);
	});

	test("is null without a title line", () => {
		expect(docsPageTitle("Bots\n\n# Bots (/docs/bots)")).toBeNull();
		expect(docsPageTitle("# Bots")).toBeNull();
	});
});

describe("readDocs", () => {
	test("reads the index without a path", async () => {
		expect(
			await Effect.runPromise(
				readDocs({
					fetch: fakeFetch,
					docs,
				}),
			),
		).toEqual({
			path: null,
			title: null,
			url: "https://docs.example.org/docs",
			content: INDEX,
		});
		expect(requested).toEqual([
			"/llms.txt",
		]);
	});

	test("reads a page with its title and public link", async () => {
		expect(
			await Effect.runPromise(
				readDocs({
					fetch: fakeFetch,
					docs,
					path: "/docs/using-orcai/bots.md",
				}),
			),
		).toEqual({
			path: "/docs/using-orcai/bots",
			title: "Bots",
			url: "https://docs.example.org/docs/using-orcai/bots",
			content: BOTS,
		});
	});

	test("resolves /docs and folder paths", async () => {
		const root = await Effect.runPromise(
			readDocs({
				fetch: fakeFetch,
				docs,
				path: "/docs",
			}),
		);
		const folder = await Effect.runPromise(
			readDocs({
				fetch: fakeFetch,
				docs,
				path: "/docs/using-orcai/",
			}),
		);

		expect(root.title).toBe("Introduction");
		expect(root.url).toBe("https://docs.example.org/docs");
		expect(folder.title).toBe("Using OrcAI");
		expect(requested).toEqual([
			"/docs/index.md",
			"/docs/using-orcai.md",
		]);
	});

	test("names a missing page", async () => {
		expect((await failure("/docs/missing")).message).toBe(
			"No docs page at /docs/missing; read the index (call readDocs without a path) for valid paths.",
		);
	});

	test.each([
		"/docs/broken",
		"/docs/html",
		"/docs/binary",
		"/docs/moved",
	])("reports %p as unavailable", async (path) => {
		expect((await failure(path)).message).toBe(
			"The docs are unavailable right now.",
		);
	});

	test("reports an unreachable site as unavailable", async () => {
		const error = await Effect.runPromise(
			Effect.flip(
				readDocs({
					fetch: fakeFetch,
					docs: {
						...docs,
						fetchOrigin: "http://127.0.0.1:1",
					},
					path: "/docs",
				}),
			),
		);

		expect(error.message).toBe("The docs are unavailable right now.");
	});

	test("never fetches a path outside the pattern", async () => {
		expect((await failure("/docs/../app")).message).toBe(
			"/docs/../app is not a docs page path.",
		);
		expect(requested).toEqual([]);
	});

	test("gives up after ten seconds", async () => {
		const request = Promise.withResolvers<AbortSignal>();
		arrived = request.resolve;

		const error = await Effect.runPromise(
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					readDocs({
						fetch: fakeFetch,
						docs,
						path: "/docs/slow",
					}),
				);
				yield* Effect.promise(() => request.promise);
				yield* TestClock.adjust("10 seconds");
				return yield* Effect.flip(Fiber.join(fiber));
			}).pipe(Effect.provide(TestClock.layer())),
		);

		expect(error.message).toBe("The docs are unavailable right now.");
	});

	test("aborts the fetch with the signal", async () => {
		const request = Promise.withResolvers<AbortSignal>();
		arrived = request.resolve;
		const controller = new AbortController();

		const result = Effect.runPromise(
			readDocs({
				fetch: fakeFetch,
				docs,
				path: "/docs/slow",
			}),
			{
				signal: controller.signal,
			},
		);
		const fetchSignal = await request.promise;
		controller.abort();

		await expect(result).rejects.toBeDefined();
		expect(fetchSignal.aborted).toBe(true);
	});
});
