import { describe, expect, test } from "bun:test";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { TWO_FACTOR_POLICIES } from "@/lib/auth/two-factor-policy";
import { appConfig, resolveDeploymentConfig } from "./config";

const twoFactorPolicyFrom = (env: Record<string, string>) =>
	Effect.runSync(
		Effect.result(
			appConfig
				.parse(
					ConfigProvider.fromUnknown({
						BETTER_AUTH_SECRET: "secret",
						BETTER_AUTH_URL: "http://localhost:3000",
						...env,
					}),
				)
				.pipe(Effect.map((config) => config.auth.twoFactorPolicy)),
		),
	);

describe("TWO_FACTOR_REQUIRED", () => {
	test("defaults to none", () => {
		expect(twoFactorPolicyFrom({})).toEqual(Result.succeed("none"));
	});

	test("reads each policy", () => {
		for (const policy of TWO_FACTOR_POLICIES)
			expect(
				twoFactorPolicyFrom({
					TWO_FACTOR_REQUIRED: policy,
				}),
			).toEqual(Result.succeed(policy));
	});

	test("refuses an unknown policy", () => {
		expect(
			Result.isFailure(
				twoFactorPolicyFrom({
					TWO_FACTOR_REQUIRED: "admin",
				}),
			),
		).toBe(true);
	});
});

describe("resolveDeploymentConfig", () => {
	test("has no docs and no analytics when nothing is set", () => {
		expect(resolveDeploymentConfig({})).toEqual({
			docs: undefined,
			publicConfig: {},
			warnings: [],
		});
	});

	test("counts empty values as unset", () => {
		expect(
			resolveDeploymentConfig({
				webUrl: "",
				webInternalUrl: "",
				umamiScriptUrl: "",
				umamiWebsiteId: "",
			}),
		).toEqual({
			docs: undefined,
			publicConfig: {},
			warnings: [],
		});
	});

	test("fetches from WEB_URL when WEB_INTERNAL_URL is unset", () => {
		expect(
			resolveDeploymentConfig({
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
			resolveDeploymentConfig({
				webUrl: "http://localhost:3001",
				webInternalUrl: "http://web:3001",
			}),
		).toEqual({
			docs: {
				publicOrigin: "http://localhost:3001",
				fetchOrigin: "http://web:3001",
			},
			publicConfig: {
				docsUrl: "http://localhost:3001",
			},
			warnings: [],
		});
	});

	test("drops a trailing slash", () => {
		const { docs, publicConfig } = resolveDeploymentConfig({
			webUrl: "https://docs.example.org/",
			webInternalUrl: "http://web:3001/",
		});

		expect(docs).toEqual({
			publicOrigin: "https://docs.example.org",
			fetchOrigin: "http://web:3001",
		});
		expect(publicConfig.docsUrl).toBe("https://docs.example.org");
	});

	test("ignores values that are not http(s) URLs and names them", () => {
		expect(
			resolveDeploymentConfig({
				webUrl: "https://docs.example.org",
				webInternalUrl: "web:3001",
			}),
		).toEqual({
			docs: {
				publicOrigin: "https://docs.example.org",
				fetchOrigin: "https://docs.example.org",
			},
			publicConfig: {
				docsUrl: "https://docs.example.org",
			},
			warnings: [
				"WEB_INTERNAL_URL is not an http(s) URL and is ignored, so the assistant may not read the docs.",
			],
		});
		expect(
			resolveDeploymentConfig({
				webUrl: "ftp://docs.example.org",
			}),
		).toEqual({
			docs: undefined,
			publicConfig: {},
			warnings: [
				"WEB_URL is not an http(s) URL and is ignored, so the assistant may not read the docs.",
			],
		});
	});

	test("does not enable the docs from WEB_INTERNAL_URL alone", () => {
		expect(
			resolveDeploymentConfig({
				webInternalUrl: "http://web:3001",
			}),
		).toEqual({
			docs: undefined,
			publicConfig: {},
			warnings: [],
		});
	});

	test("enables Umami when both values are set", () => {
		expect(
			resolveDeploymentConfig({
				umamiScriptUrl: "https://umami.example.org/script.js",
				umamiWebsiteId: "site",
			}),
		).toEqual({
			docs: undefined,
			publicConfig: {
				umami: {
					scriptUrl: "https://umami.example.org/script.js",
					websiteId: "site",
				},
			},
			warnings: [],
		});
	});

	test("keeps Umami off and warns when only one value is set", () => {
		for (const env of [
			{
				umamiScriptUrl: "https://umami.example.org/script.js",
			},
			{
				umamiWebsiteId: "site",
			},
		]) {
			expect(resolveDeploymentConfig(env)).toEqual({
				docs: undefined,
				publicConfig: {},
				warnings: [
					"Only one of UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID is set, so analytics stay off.",
				],
			});
		}
	});
});
