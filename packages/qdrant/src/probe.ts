import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { qdrantCall } from "./client";
import { QdrantService } from "./service";

/** Whether Qdrant answers; the embedding check covers the active collection. */
export const probeQdrant = Effect.gen(function* () {
	const { client } = yield* QdrantService;
	const versionInfo = yield* qdrantCall("probe", () => client.versionInfo());
	return {
		ok: true,
		version: versionInfo.version,
	} satisfies ProbeResult;
});
