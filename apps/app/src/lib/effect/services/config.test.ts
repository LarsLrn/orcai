import { describe, expect, test } from "bun:test";
import { resolveDocsConfig } from "./config";

describe("resolveDocsConfig", () => {
	test("has no docs without VITE_WEB_URL", () => {
		expect(resolveDocsConfig({})).toEqual({
			docs: undefined,
			invalid: [],
		});
	});

	test("counts empty values as unset", () => {
		expect(
			resolveDocsConfig({
				webUrl: "",
				webInternalUrl: "",
			}),
		).toEqual({
			docs: undefined,
			invalid: [],
		});
	});

	test("fetches from VITE_WEB_URL when WEB_INTERNAL_URL is unset", () => {
		expect(
			resolveDocsConfig({
				webUrl: "https://docs.example.org",
				webInternalUrl: "",
			}).docs,
		).toEqual({
			publicOrigin: "https://docs.example.org",
			fetchOrigin: "https://docs.example.org",
		});
	});

	test("fetches from WEB_INTERNAL_URL when set", () => {
		expect(
			resolveDocsConfig({
				webUrl: "http://localhost:3001",
				webInternalUrl: "http://web:3001",
			}).docs,
		).toEqual({
			publicOrigin: "http://localhost:3001",
			fetchOrigin: "http://web:3001",
		});
	});

	test("drops a trailing slash", () => {
		expect(
			resolveDocsConfig({
				webUrl: "https://docs.example.org/",
				webInternalUrl: "http://web:3001/",
			}).docs,
		).toEqual({
			publicOrigin: "https://docs.example.org",
			fetchOrigin: "http://web:3001",
		});
	});

	test("ignores values that are not http(s) URLs and names them", () => {
		expect(
			resolveDocsConfig({
				webUrl: "https://docs.example.org",
				webInternalUrl: "web:3001",
			}),
		).toEqual({
			docs: {
				publicOrigin: "https://docs.example.org",
				fetchOrigin: "https://docs.example.org",
			},
			invalid: [
				"WEB_INTERNAL_URL",
			],
		});
		expect(
			resolveDocsConfig({
				webUrl: "ftp://docs.example.org",
			}),
		).toEqual({
			docs: undefined,
			invalid: [
				"VITE_WEB_URL",
			],
		});
	});

	test("does not enable the docs from WEB_INTERNAL_URL alone", () => {
		expect(
			resolveDocsConfig({
				webInternalUrl: "http://web:3001",
			}).docs,
		).toBeUndefined();
	});
});
