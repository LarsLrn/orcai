import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

const dbConfig = Config.all({
	postgres: Config.all({
		user: Config.String("POSTGRES_USER"),
		password: Config.Redacted("POSTGRES_PASSWORD"),
		host: Config.String("POSTGRES_HOST"),
		port: Config.withDefault(Config.Port("POSTGRES_PORT"), 5432),
		db: Config.String("POSTGRES_DB"),
		/** The most connections each pool of a process opens. */
		poolMax: Config.withDefault(
			Config.schema(
				Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
				"POSTGRES_POOL_MAX",
			),
			10,
		),
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
