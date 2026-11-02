import { S3ConfigLive, S3ConfigService } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { AppConfigService } from "@/lib/effect/services/config";
import type { PolicyOrigins } from "./content-security-policy";

export const policyOrigins = Effect.gen(function* () {
	const { config } = yield* S3ConfigService;
	const { publicConfig } = yield* AppConfigService;
	const storage = Option.getOrElse(
		config.publicEndpoint,
		() => config.endpoint,
	);

	return {
		storage: new URL(storage).origin,
		...(publicConfig.umami && {
			analytics: new URL(publicConfig.umami.scriptUrl).origin,
		}),
	} satisfies PolicyOrigins;
}).pipe(Effect.provide(S3ConfigLive));
