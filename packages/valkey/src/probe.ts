import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { ValkeyError } from "./errors";
import { ValkeyService } from "./service";

// Valkey also reports the Redis version it is compatible with.
const serverVersion = (info: string) =>
	(info.match(/^valkey_version:(\S+)/m) ??
		info.match(/^redis_version:(\S+)/m))?.[1];

export const probeValkey = Effect.gen(function* () {
	const { client } = yield* ValkeyService;
	const info = yield* Effect.tryPromise({
		try: async () => {
			await client.ping();
			return client.info("server");
		},
		catch: (cause) =>
			new ValkeyError({
				operation: "probe",
				cause,
			}),
	});

	return {
		ok: true,
		version: serverVersion(info),
	} satisfies ProbeResult;
});
