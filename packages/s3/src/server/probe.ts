import { buckets, type ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { sendHeadBucketCommand } from "./commands";

export const probeS3 = Effect.forEach(
	Object.values(buckets),
	(bucket) =>
		sendHeadBucketCommand({
			bucket: bucket.name,
		}).pipe(
			Effect.as(undefined),
			Effect.catchTag("S3Error", () => Effect.succeed(bucket.name)),
		),
	{
		concurrency: "unbounded",
	},
).pipe(
	Effect.map((results): ProbeResult => {
		const unreachable = results.filter((name) => name !== undefined);
		return unreachable.length === 0
			? {
					ok: true,
				}
			: {
					ok: false,
					detail: `Bucket not reachable: ${unreachable.join(", ")}.`,
				};
	}),
);
