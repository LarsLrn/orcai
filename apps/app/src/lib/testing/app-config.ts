import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import type { AppConfigService } from "@/lib/effect/services/config";

type AppConfig = AppConfigService["Service"];

/** A complete app config for unit tests, with `auth` fields replaced by `overrides`. */
export const testAppConfig = (
	overrides: Partial<AppConfig["config"]["auth"]> = {},
): AppConfig => ({
	config: {
		auth: {
			secret: Redacted.make("test-secret"),
			url: "http://localhost:3000",
			rateLimit: Option.none(),
			twoFactorPolicy: "none",
			...overrides,
		},
	},
	docs: undefined,
	publicConfig: {},
	warnings: [],
});
