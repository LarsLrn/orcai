import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { SqlClient } from "effect/sql";
import { DbConfigLive, DbConfigService } from "./config";
import { makePgConnectionString } from "./pg-connection-string";
import { relations } from "./schema/relations";

/** Names this process's query connections in `pg_stat_activity`. */
export const applicationName = `orcai-${process.pid}`;

const PgClientLive: Layer.Layer<
	PgClient.PgClient | SqlClient.SqlClient,
	unknown
> = Layer.unwrap(
	Effect.gen(function* () {
		const { config } = yield* DbConfigService;
		const url = makePgConnectionString(config);

		return PgClient.layer({
			url,
			maxConnections: config.poolMax,
			applicationName,
			// Compiling short queries costs far more than it saves.
			startupParameters: {
				jit: "off",
			},
		});
	}),
).pipe(Layer.provide(DbConfigLive));

const dbEffect = PgDrizzle.make({
	relations,
}).pipe(Effect.provide(PgDrizzle.DefaultServices));

export class DB extends Context.Service<DB, Effect.Success<typeof dbEffect>>()(
	"DB",
) {}

export const DBLive = Layer.effect(DB, dbEffect);

export const DrizzleLive = Layer.provideMerge(DBLive, PgClientLive);
