import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const dbConfig = Config.all({
	postgres: Config.all({
		user: Config.string("POSTGRES_USER"),
		password: Config.redacted("POSTGRES_PASSWORD"),
		host: Config.string("POSTGRES_HOST"),
		port: Config.withDefault(Config.port("POSTGRES_PORT"), 5432),
		db: Config.string("POSTGRES_DB"),
	}),
});

type DbConfig = Config.Config.Success<typeof dbConfig>;

export class DbConfigService extends Context.Tag("DbConfigService")<
	DbConfigService,
	{
		readonly config: DbConfig;
	}
>() {}

export const DbConfigLive = Layer.effect(
	DbConfigService,
	dbConfig.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);

export const loadDbConfigSync = (): DbConfig => Effect.runSync(dbConfig);
