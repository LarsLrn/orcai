import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

/** Whether Qdrant answers; the embedding check covers the active collection. */
export const probeQdrant = Effect.gen(function* () {
	const { client } = yield* QdrantService;
	const versionInfo = yield* Effect.tryPromise({
		try: () => client.versionInfo(),
		catch: (cause) =>
			new QdrantError({
				operation: "probe",
				cause,
			}),
	});
	return {
		ok: true,
		version: versionInfo.version,
	} satisfies ProbeResult;
});
