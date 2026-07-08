import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createClient, type RedisClientType } from "redis";
import { ValkeyConfigLive, ValkeyConfigService } from "./config";
import { ValkeyError } from "./errors";

export type ValkeyClient = RedisClientType;

export class ValkeyService extends Context.Service<
	ValkeyService,
	{
		readonly client: ValkeyClient;
	}
>()("ValkeyService") {}

export const ValkeyServiceLive = Layer.effect(
	ValkeyService,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* ValkeyConfigService;

			const client = createClient({
				url: config.valkey.url,
			});

			yield* Effect.tryPromise({
				try: () => client.connect(),
				catch: (cause) =>
					new ValkeyError({
						operation: "connect",
						cause,
					}),
			});

			return {
				client,
			};
		}),
		({ client }) =>
			Effect.tryPromise({
				try: () => client.quit(),
				catch: () => undefined,
			}).pipe(Effect.orDie),
	),
);

export const ValkeyLive = ValkeyServiceLive.pipe(
	Layer.provide(ValkeyConfigLive),
);
