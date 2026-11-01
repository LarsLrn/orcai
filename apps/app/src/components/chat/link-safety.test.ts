import { describe, expect, test } from "bun:test";
import { isTrustedLink } from "./link-safety";

const origins = {
	appOrigin: "https://orcai.example.org",
	docsUrl: "https://docs.example.org",
	appPaths: true,
};

describe("isTrustedLink", () => {
	test.each([
		"/app",
		"/app/library/bots",
		"/app/library/bots/123?tab=access",
		"https://orcai.example.org/app/organization",
		"https://docs.example.org/docs",
		"https://docs.example.org/docs/using-orcai/bots",
		"https://docs.example.org/docs/using-orcai/bots#bot-lifecycle",
	])("trusts %p", (url) => {
		expect(isTrustedLink(url, origins)).toBe(true);
	});

	test.each([
		"/instance/users",
		"/application",
		"//evil.example/app/library",
		"https://evil.example/app/library",
		"http://docs.example.org/docs",
		"https://docs.example.org.evil.example/docs",
		"javascript:alert(1)",
		"mailto:someone@example.org",
		"https://docs.example.org",
		"https://docs.example.org/not-a-docs-page",
		"https://docs.example.org/docs/../account",
		"https://user:password@docs.example.org/docs/using-orcai/bots",
		"https://user:password@orcai.example.org/app/library",
	])("asks before opening %p", (url) => {
		expect(isTrustedLink(url, origins)).toBe(false);
	});

	test("trusts only paths under a docs URL with a path", () => {
		const docsUnderPath = {
			...origins,
			docsUrl: "https://example.org/orcai-docs/",
		};

		expect(
			isTrustedLink(
				"https://example.org/orcai-docs/docs/using-orcai",
				docsUnderPath,
			),
		).toBe(true);
		expect(isTrustedLink("https://example.org/other", docsUnderPath)).toBe(
			false,
		);
	});

	test("trusts no docs links without a docs URL", () => {
		expect(
			isTrustedLink("https://docs.example.org/docs", {
				...origins,
				docsUrl: undefined,
			}),
		).toBe(false);
	});

	test("trusts app paths only where the chat allows them", () => {
		expect(
			isTrustedLink("/app/library/bots", {
				...origins,
				appPaths: false,
			}),
		).toBe(false);
		expect(
			isTrustedLink("https://docs.example.org/docs", {
				...origins,
				appPaths: false,
			}),
		).toBe(true);
	});
});
