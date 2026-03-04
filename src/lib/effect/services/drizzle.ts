import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { types } from "pg";
import { pgPool } from "@/db/pool";
import { relations } from "@/db/schema/relations";

// Unwrap the Config into a layer so the connection string
// is only resolved when the layer builds (not at import time).
const PgClientLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		return PgClient.layerFromPool({
			acquire: Effect.succeed(pgPool),
			types: {
				getTypeParser: (typeId, format) => {
					if (
						[
							1184,
							1114,
							1082,
							1186,
							1231,
							1115,
							1185,
							1187,
							1182,
						].includes(typeId)
					) {
						return (val: any) => val;
					}
					return types.getTypeParser(typeId, format);
				},
			},
		});
	}),
);

const dbEffect = PgDrizzle.make({
	relations,
}).pipe(Effect.provide(PgDrizzle.DefaultServices));

export class DB extends Context.Tag("DB")<
	DB,
	Effect.Effect.Success<typeof dbEffect>
>() {}

const DBLive = Layer.scoped(DB, dbEffect);

export const DrizzleLive = Layer.provideMerge(DBLive, PgClientLive);
