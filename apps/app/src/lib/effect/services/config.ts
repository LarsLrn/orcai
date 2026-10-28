import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { TWO_FACTOR_POLICIES } from "@/lib/auth/two-factor-policy";

export const appConfig = Config.all({
	auth: Config.all({
		secret: Config.Redacted("BETTER_AUTH_SECRET"),
		url: Config.String("BETTER_AUTH_URL"),
		// Unset keeps Better Auth's default: on in production.
		rateLimit: Config.option(Config.Boolean("BETTER_AUTH_RATE_LIMIT")),
		twoFactorPolicy: Config.Literals(
			TWO_FACTOR_POLICIES,
			"TWO_FACTOR_REQUIRED",
		).pipe(Config.withDefault("none")),
	}),
});

const deploymentEnv = Config.all({
	webUrl: Config.option(Config.String("WEB_URL")),
	webInternalUrl: Config.option(Config.String("WEB_INTERNAL_URL")),
	umamiScriptUrl: Config.option(Config.String("UMAMI_SCRIPT_URL")),
	umamiWebsiteId: Config.option(Config.String("UMAMI_WEBSITE_ID")),
});

type AppConfig = Config.Success<typeof appConfig>;

/** Where the assistant links the docs site, and where the server reads it. */
export interface DocsConfig {
	readonly publicOrigin: string;
	readonly fetchOrigin: string;
}

/** What the browser may know about this deployment. */
export interface PublicConfig {
	readonly docsUrl?: string;
	readonly umami?: {
		readonly scriptUrl: string;
		readonly websiteId: string;
	};
}

const parseOrigin = (value: string | undefined) => {
	if (!value) {
		return {
			origin: undefined,
			invalid: false,
		};
	}

	const url = URL.parse(value);
	const valid = url?.protocol === "http:" || url?.protocol === "https:";

	return {
		origin: valid ? value.replace(/\/$/, "") : undefined,
		invalid: !valid,
	};
};

/**
 * Empty and non-http(s) URLs count as unset; without a public URL there are no
 * docs. Umami needs both values or stays off.
 */
export const resolveDeploymentConfig = (env: {
	webUrl?: string;
	webInternalUrl?: string;
	umamiScriptUrl?: string;
	umamiWebsiteId?: string;
}): {
	docs: DocsConfig | undefined;
	publicConfig: PublicConfig;
	warnings: string[];
} => {
	const web = parseOrigin(env.webUrl);
	const internal = parseOrigin(env.webInternalUrl);
	const docs = web.origin
		? {
				publicOrigin: web.origin,
				fetchOrigin: internal.origin ?? web.origin,
			}
		: undefined;
	const umami =
		env.umamiScriptUrl && env.umamiWebsiteId
			? {
					scriptUrl: env.umamiScriptUrl,
					websiteId: env.umamiWebsiteId,
				}
			: undefined;

	return {
		docs,
		publicConfig: {
			...(docs && {
				docsUrl: docs.publicOrigin,
			}),
			...(umami && {
				umami,
			}),
		},
		warnings: [
			...(
				[
					[
						"WEB_URL",
						web,
					],
					[
						"WEB_INTERNAL_URL",
						internal,
					],
				] as const
			)
				.filter(([, parsed]) => parsed.invalid)
				.map(
					([name]) =>
						`${name} is not an http(s) URL and is ignored, so the assistant may not read the docs.`,
				),
			...(!umami && (env.umamiScriptUrl || env.umamiWebsiteId)
				? [
						"Only one of UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID is set, so analytics stay off.",
					]
				: []),
		],
	};
};

export class AppConfigService extends Context.Service<
	AppConfigService,
	{
		readonly config: AppConfig;
		readonly docs: DocsConfig | undefined;
		readonly publicConfig: PublicConfig;
		readonly warnings: readonly string[];
	}
>()("AppConfigService") {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	Effect.gen(function* () {
		const config = yield* appConfig;
		const env = yield* deploymentEnv;
		const { docs, publicConfig, warnings } = resolveDeploymentConfig({
			webUrl: Option.getOrUndefined(env.webUrl),
			webInternalUrl: Option.getOrUndefined(env.webInternalUrl),
			umamiScriptUrl: Option.getOrUndefined(env.umamiScriptUrl),
			umamiWebsiteId: Option.getOrUndefined(env.umamiWebsiteId),
		});

		for (const warning of warnings) {
			yield* Effect.logWarning(warning);
		}

		return {
			config,
			docs,
			publicConfig,
			warnings,
		};
	}),
);

export const loadAppConfigSync = (): AppConfig =>
	Effect.runSync(
		Effect.gen(function* () {
			return yield* appConfig;
		}),
	);
