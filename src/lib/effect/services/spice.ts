import { v1 } from "@authzed/authzed-node";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SpiceDbError } from "@/lib/effect/utils/errors";
import { serverEnv } from "@/lib/env/server";

export class SpiceDbService extends Context.Tag("SpiceDbService")<
	SpiceDbService,
	{
		readonly spice: v1.ZedPromiseClientInterface;
	}
>() {}

export const SpiceDbLive = Layer.scoped(
	SpiceDbService,
	Effect.tryPromise({
		try: async () =>
			v1.NewClient(
				serverEnv.SPICEDB_TOKEN,
				serverEnv.SPICEDB_ENDPOINT,
				v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
			),
		catch: (error) =>
			new SpiceDbError({
				operation: "start",
				cause: error,
			}),
	}).pipe(
		Effect.map((spice) => ({ spice: spice.promises })),
		Effect.tap(() => Effect.logInfo("SpiceDb service started successfully")),
	),
);
