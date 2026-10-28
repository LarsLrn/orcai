import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

export const probeQdrant = Effect.gen(function* () {
	const { client, collections } = yield* QdrantService;
	const [versionInfo, existence] = yield* Effect.tryPromise({
		try: () =>
			Promise.all([
				client.versionInfo(),
				client.collectionExists(collections.asset.name),
			]),
		catch: (cause) =>
			new QdrantError({
				operation: "probe",
				cause,
			}),
	});

	const result: ProbeResult = existence.exists
		? {
				ok: true,
				version: versionInfo.version,
			}
		: {
				ok: false,
				version: versionInfo.version,
				detail: `Collection "${collections.asset.name}" is missing.`,
			};
	return result;
});
