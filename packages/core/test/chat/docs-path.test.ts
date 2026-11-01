import { describe, expect, test } from "bun:test";
import { docsMarkdownPath } from "../../src";

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
