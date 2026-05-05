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

type DbConfig = Config.Success<typeof dbConfig>;

export class DbConfigService extends Context.Service<
	DbConfigService,
	{
		readonly config: DbConfig;
	}
>()("DbConfigService") {}

export const DbConfigLive = Layer.effect(
	DbConfigService,
	Effect.gen(function* () {
		const config = yield* dbConfig;

		return {
			config,
		};
	}),
);

export const loadDbConfigSync = (): DbConfig =>
	Effect.runSync(
		Effect.gen(function* () {
			return yield* dbConfig;
		}),
	);
