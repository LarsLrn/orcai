import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { types } from "pg";
import { relations } from "@/db/schema/relations";

// Build the connection URL from individual env vars via Effect Config,
// avoiding bare secrets at module scope.
const pgUrl = Config.all({
	user: Config.string("POSTGRES_USER"),
	password: Config.redacted("POSTGRES_PASSWORD"),
	host: Config.string("POSTGRES_HOST"),
	port: Config.withDefault(Config.number("POSTGRES_PORT"), 5432),
	db: Config.string("POSTGRES_DB"),
}).pipe(
	Config.map(({ user, password, host, port, db }) =>
		Redacted.make(
			`postgres://${user}:${Redacted.value(password)}@${host}:${port}/${db}`,
		),
	),
);

// Unwrap the Config into a layer so the connection string
// is only resolved when the layer builds (not at import time).
const PgClientLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const url = yield* pgUrl;
		return PgClient.layer({
			url,
			types: {
				getTypeParser: (typeId, format) => {
					if (
						[1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(
							typeId,
						)
					) {
						return (val: any) => val;
					}
					return types.getTypeParser(typeId, format);
				},
			},
		});
	}),
);

const dbEffect = PgDrizzle.make({ relations }).pipe(
	Effect.provide(PgDrizzle.DefaultServices),
);

export class DB extends Context.Tag("DB")<
	DB,
	Effect.Effect.Success<typeof dbEffect>
>() {}

const DBLive = Layer.scoped(DB, dbEffect);

export const DrizzleLive = Layer.provideMerge(DBLive, PgClientLive);
