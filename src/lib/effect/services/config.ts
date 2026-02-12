import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const appConfig = Config.all({
	postgres: Config.all({
		user: Config.string("POSTGRES_USER"),
		password: Config.string("POSTGRES_PASSWORD"),
		host: Config.string("POSTGRES_HOST"),
		port: Config.withDefault(Config.port("POSTGRES_PORT"), 5432),
		db: Config.string("POSTGRES_DB"),
	}),
	s3: Config.all({
		region: Config.string("S3_REGION"),
		endpoint: Config.string("S3_ENDPOINT"),
		accessKey: Config.string("S3_ACCESS_KEY"),
		secretKey: Config.string("S3_SECRET_KEY"),
	}),
	spice: Config.all({
		endpoint: Config.string("SPICEDB_ENDPOINT"),
		token: Config.string("SPICEDB_TOKEN"),
	}),
	ai: Config.all({
		baseUrl: Config.string("OPENAI_COMPATIBLE_BASE_URL"),
		apiKey: Config.string("OPENAI_COMPATIBLE_API_KEY"),
	}),
	auth: Config.all({
		secret: Config.string("BETTER_AUTH_SECRET"),
		url: Config.string("BETTER_AUTH_URL"),
	}),
	qdrant: Config.all({
		url: Config.string("QDRANT_URL"),
		apiKey: Config.string("QDRANT_API_KEY"),
	}),
	mail: Config.all({
		host: Config.string("SMTP_HOST"),
		port: Config.withDefault(Config.port("SMTP_PORT"), 587),
		username: Config.string("SMTP_USERNAME"),
		password: Config.string("SMTP_PASSWORD"),
	}),
});

type AppConfig = Config.Config.Success<typeof appConfig>;

export class AppConfigService extends Context.Tag("AppConfigService")<
	AppConfigService,
	{ readonly config: AppConfig }
>() {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	appConfig.pipe(Effect.map((config) => ({ config }))),
);

export const loadAppConfigSync = (): AppConfig => Effect.runSync(appConfig);
