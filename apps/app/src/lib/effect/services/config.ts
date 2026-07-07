import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const appConfig = Config.all({
	auth: Config.all({
		secret: Config.redacted("BETTER_AUTH_SECRET"),
		url: Config.string("BETTER_AUTH_URL"),
	}),
	app: Config.all({
		encryptionKey: Config.redacted("ENCRYPTION_KEY"),
	}),
});

type AppConfig = Config.Success<typeof appConfig>;

export class AppConfigService extends Context.Service<
	AppConfigService,
	{
		readonly config: AppConfig;
	}
>()("AppConfigService") {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	Effect.gen(function* () {
		const config = yield* appConfig;

		return {
			config,
		};
	}),
);

export const loadAppConfigSync = (): AppConfig =>
	Effect.runSync(
		Effect.gen(function* () {
			return yield* appConfig;
		}),
	);
