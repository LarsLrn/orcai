import { presignOrigin, S3ConfigLive } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { AppConfigService } from "@/lib/effect/services/config";
import type { PolicyOrigins } from "./content-security-policy";

export const policyOrigins = Effect.gen(function* () {
	const { publicConfig } = yield* AppConfigService;

	return {
		storage: yield* presignOrigin,
		...(publicConfig.umami && {
			analytics: new URL(publicConfig.umami.scriptUrl).origin,
		}),
	} satisfies PolicyOrigins;
}).pipe(Effect.provide(S3ConfigLive));
