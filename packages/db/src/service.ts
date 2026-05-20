import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { types } from "pg";
import { DbConfigLive, DbConfigService } from "./config";
import { makePgConnectionString } from "./pg-connection-string";
import { relations } from "./schema/relations";

const pgStringTypeIds = new Set([
	1184,
	1114,
	1082,
	1186,
	1231,
	1115,
	1185,
	1187,
	1182,
]);

export const PgClientServiceLive: Layer.Layer<
	PgClient.PgClient,
	unknown,
	DbConfigService
> = Layer.unwrap(
	Effect.gen(function* () {
		const { config } = yield* DbConfigService;
		const url = makePgConnectionString(config.postgres);

		return PgClient.layer({
			url,
			types: {
				getTypeParser: (typeId, format) => {
					if (pgStringTypeIds.has(typeId)) {
						return (val: any) => val;
					}
					return types.getTypeParser(typeId, format);
				},
			},
		});
	}),
);

export const PgClientLive = PgClientServiceLive.pipe(
	Layer.provide(DbConfigLive),
);

const dbEffect = PgDrizzle.make({
	relations,
}).pipe(Effect.provide(PgDrizzle.DefaultServices));

export class DB extends Context.Service<DB, Effect.Success<typeof dbEffect>>()(
	"DB",
) {}

export const DBLive = Layer.effect(DB, dbEffect);

export const DrizzleLive = Layer.provideMerge(DBLive, PgClientLive);
