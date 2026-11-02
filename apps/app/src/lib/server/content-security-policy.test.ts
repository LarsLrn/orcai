import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy } from "./content-security-policy";

const directives = (policy: string) =>
	new Map(
		policy.split("; ").map((directive) => {
			const [name, ...sources] = directive.split(" ");
			return [
				name,
				sources,
			];
		}),
	);

describe("contentSecurityPolicy", () => {
	test("allows scripts only with the request's nonce", () => {
		const policy = directives(
			contentSecurityPolicy({
				nonce: "abc",
				origins: {
					storage: "https://storage.example",
				},
			}),
		);
		expect(policy.get("script-src")).toEqual([
			"'self'",
			"'nonce-abc'",
		]);
		expect(policy.get("object-src")).toEqual([
			"'none'",
		]);
	});

	test("loads images only from the app and object storage", () => {
		const policy = directives(
			contentSecurityPolicy({
				nonce: "abc",
				origins: {
					storage: "https://storage.example",
				},
			}),
		);
		expect(policy.get("img-src")).toEqual([
			"'self'",
			"data:",
			"blob:",
			"https://storage.example",
		]);
		expect(policy.get("connect-src")).toEqual([
			"'self'",
			"https://storage.example",
		]);
	});

	test("lets configured analytics load and report", () => {
		const policy = directives(
			contentSecurityPolicy({
				nonce: "abc",
				origins: {
					storage: "https://storage.example",
					analytics: "https://umami.example",
				},
			}),
		);
		expect(policy.get("script-src")).toContain("https://umami.example");
		expect(policy.get("connect-src")).toContain("https://umami.example");
	});

	test("without a nonce or origins allows only the app itself", () => {
		const policy = directives(contentSecurityPolicy());
		expect(policy.get("script-src")).toEqual([
			"'self'",
		]);
		expect(policy.get("connect-src")).toEqual([
			"'self'",
		]);
	});
});
