import { deadlineInterceptor, v1 } from "@authzed/authzed-node";
import { InterceptingCall, type Interceptor } from "@grpc/grpc-js";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	SpiceDbConfigLive,
	SpiceDbConfigService,
	type SpiceDbSecurityMode,
} from "./config";
import { SpiceDbError } from "./errors";

export class SpiceDbService extends Context.Service<
	SpiceDbService,
	{
		readonly spice: v1.ZedPromiseClientInterface;
	}
>()("SpiceDbService") {}

const securityModeMap: Record<SpiceDbSecurityMode, v1.ClientSecurity> = {
	secure: v1.ClientSecurity.SECURE,
	"insecure-localhost": v1.ClientSecurity.INSECURE_LOCALHOST_ALLOWED,
	"insecure-plaintext": v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
};

const READS = new Set(
	[
		"CheckPermission",
		"CheckBulkPermissions",
		"LookupResources",
	].map((method) => `/authzed.api.v1.PermissionsService/${method}`),
);

/** Ends a permission read after `timeout`, so a request does not wait on an unreachable SpiceDB. */
const readDeadline = (timeout: Duration.Duration): Interceptor => {
	const deadline = deadlineInterceptor(Duration.toMillis(timeout));
	return (options, nextCall) =>
		READS.has(options.method_definition.path)
			? deadline(options, nextCall)
			: new InterceptingCall(nextCall(options));
};

export const SpiceDbServiceLive = Layer.effect(
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
					// The default preconnect, the permissions service.
					undefined,
					{
						interceptors: [
							readDeadline(config.spice.readTimeout),
						],
					},
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
