import { v1 } from "@authzed/authzed-node";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	SpiceDbConfigLive,
	SpiceDbConfigService,
	type SpiceDbSecurityMode,
} from "./config";
import { SpiceDbError } from "./errors";

export class SpiceDbService extends Context.Tag("SpiceDbService")<
	SpiceDbService,
	{
		readonly spice: v1.ZedPromiseClientInterface;
	}
>() {}

const securityModeMap: Record<SpiceDbSecurityMode, v1.ClientSecurity> = {
	secure: v1.ClientSecurity.SECURE,
	"insecure-localhost": v1.ClientSecurity.INSECURE_LOCALHOST_ALLOWED,
	"insecure-plaintext": v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
};

export const SpiceDbServiceLive = Layer.scoped(
	SpiceDbService,
	Effect.gen(function* () {
		const { config } = yield* SpiceDbConfigService;
		const security = securityModeMap[config.spice.security];

		return yield* Effect.tryPromise({
			try: async () =>
				v1.NewClient(
					Redacted.value(config.spice.token),
					config.spice.endpoint,
					security,
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "start",
					cause: error,
				}),
		}).pipe(
			Effect.map((spice) => ({
				spice: spice.promises,
			})),
			Effect.tap(() => Effect.logInfo("SpiceDb service started successfully")),
		);
	}),
);

export const SpiceDbLive = SpiceDbServiceLive.pipe(
	Layer.provide(SpiceDbConfigLive),
);
