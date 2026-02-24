import { v1 } from "@authzed/authzed-node";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { SpiceDbError } from "@/lib/effect/utils/errors";
import { AppConfigService } from "./config";

export class SpiceDbService extends Context.Tag("SpiceDbService")<
	SpiceDbService,
	{ readonly spice: v1.ZedPromiseClientInterface }
>() {}

export const SpiceDbLive = Layer.scoped(
	SpiceDbService,
	Effect.gen(function* () {
		const { config } = yield* AppConfigService;

		return yield* Effect.tryPromise({
			try: async () =>
				v1.NewClient(
					Redacted.value(config.spice.token),
					config.spice.endpoint,
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
		);
	}),
);
