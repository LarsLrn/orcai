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

/** The SpiceDB calls OrcAI makes. */
export type SpiceDbClient = Pick<
	v1.ZedPromiseClientInterface,
	| "checkPermission"
	| "checkBulkPermissions"
	| "lookupResources"
	| "readRelationships"
	| "writeRelationships"
	| "deleteRelationships"
	| "readSchema"
	| "writeSchema"
	| "diffSchema"
>;

export class SpiceDbService extends Context.Service<
	SpiceDbService,
	{
		readonly spice: SpiceDbClient;
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

		const client = yield* Effect.try({
			try: () =>
				v1.NewClient(
					Redacted.value(config.token),
					config.endpoint,
					securityModeMap[config.security],
					// The default preconnect, the permissions service.
					undefined,
					{
						interceptors: [
							readDeadline(config.readTimeout),
						],
					},
				),
			catch: (cause) =>
				new SpiceDbError({
					operation: "start",
					cause,
				}),
		});
		yield* Effect.logInfo("SpiceDb service started successfully");

		return {
			spice: client.promises,
		};
	}),
);

export const SpiceDbLive = SpiceDbServiceLive.pipe(
	Layer.provide(SpiceDbConfigLive),
);

/** One call on the SpiceDB client, failing as a SpiceDbError for `operation`. */
export const callSpiceDb = <A>(
	operation: "query" | "mutate",
	call: (spice: SpiceDbClient) => Promise<A>,
) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;
		return yield* Effect.tryPromise({
			try: () => call(spice),
			catch: (cause) =>
				new SpiceDbError({
					operation,
					cause,
				}),
		});
	});
