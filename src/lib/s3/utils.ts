import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { S3Service } from "@/lib/effect/services/s3";
import { S3Error } from "@/lib/effect/utils/errors";
import { buckets } from "@/settings/buckets";

const isMissingBucket = (cause: unknown) => {
	const e = cause as { name?: string; $metadata?: { httpStatusCode?: number } };
	return (
		e?.$metadata?.httpStatusCode === 404 ||
		e?.name === "NotFound" ||
		e?.name === "NoSuchBucket"
	);
};

export const createBucketIfNotExists = (bucketName: string) =>
	Effect.gen(function* () {
		// TODO: Add this to an initialization script or migration instead of checking every time
		const { client } = yield* S3Service;

		const allowedBuckets = Object.values(buckets).map((b) => b.name);

		if (!allowedBuckets.includes(bucketName)) {
			return yield* new S3Error({
				operation: "createBucketIfNotExists",
				cause: "forbidden_bucket",
			});
		}

		return yield* Effect.tryPromise({
			try: async () =>
				client.send(new HeadBucketCommand({ Bucket: bucketName })),
			catch: (cause) =>
				new S3Error({ operation: "createBucketIfNotExists", cause }),
		}).pipe(
			Effect.catchAll((err) =>
				Match.value(err.cause).pipe(
					Match.when(isMissingBucket, () =>
						Effect.tryPromise({
							try: () =>
								client.send(
									new CreateBucketCommand({
										Bucket: bucketName,
									}),
								),
							catch: (cause) =>
								new S3Error({ operation: "createBucketIfNotExists", cause }),
						}),
					),
					Match.orElse(
						() =>
							new S3Error({
								operation: "createBucketIfNotExists",
								cause: err.cause,
							}),
					),
				),
			),
		);
	});
