import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

const appConfig = Config.all({
	auth: Config.all({
		secret: Config.redacted("BETTER_AUTH_SECRET"),
		url: Config.string("BETTER_AUTH_URL"),
	}),
	app: Config.all({
		encryptionKey: Config.redacted("ENCRYPTION_KEY"),
	}),
});

const docsEnv = Config.all({
	webUrl: Config.option(Config.string("VITE_WEB_URL")),
	webInternalUrl: Config.option(Config.string("WEB_INTERNAL_URL")),
});

type AppConfig = Config.Success<typeof appConfig>;

/** Where the assistant links the docs site, and where the server reads it. */
export interface DocsConfig {
	readonly publicOrigin: string;
	readonly fetchOrigin: string;
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

/** Empty and non-http(s) values count as unset; without a public URL there are no docs. */
export const resolveDocsConfig = (env: {
	webUrl?: string;
	webInternalUrl?: string;
}): {
	docs: DocsConfig | undefined;
	invalid: ("VITE_WEB_URL" | "WEB_INTERNAL_URL")[];
} => {
	const web = parseOrigin(env.webUrl);
	const internal = parseOrigin(env.webInternalUrl);

	return {
		docs: web.origin
			? {
					publicOrigin: web.origin,
					fetchOrigin: internal.origin ?? web.origin,
				}
			: undefined,
		invalid: (
			[
				[
					"VITE_WEB_URL",
					web,
				],
				[
					"WEB_INTERNAL_URL",
					internal,
				],
			] as const
		)
			.filter(([, parsed]) => parsed.invalid)
			.map(([name]) => name),
	};
};

export class AppConfigService extends Context.Service<
	AppConfigService,
	{
		readonly config: AppConfig;
		readonly docs: DocsConfig | undefined;
	}
>()("AppConfigService") {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	Effect.gen(function* () {
		const config = yield* appConfig;
		const env = yield* docsEnv;
		const { docs, invalid } = resolveDocsConfig({
			webUrl: Option.getOrUndefined(env.webUrl),
			webInternalUrl: Option.getOrUndefined(env.webInternalUrl),
		});

		for (const name of invalid) {
			yield* Effect.logWarning(
				`${name} is not an http(s) URL and is ignored, so the assistant may not read the docs.`,
			);
		}

		return {
			config,
			docs,
		};
	}),
);

export const loadAppConfigSync = (): AppConfig =>
	Effect.runSync(
		Effect.gen(function* () {
			return yield* appConfig;
		}),
	);
