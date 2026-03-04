import * as Effect from "effect/Effect";
import { S3Error } from "@/lib/effect/utils/errors";
import type { BucketName } from "@/settings/buckets";
import {
	sendDeleteObjectCommand,
	sendGetObjectCommand,
	sendListObjectsCommand,
} from "./commands";
import { createBucketIfNotExists } from "./utils";

export const deletePrefixRecursively = ({
	bucket,
	prefix,
}: {
	bucket: BucketName;
	prefix: string;
}) =>
	Effect.gen(function* () {
		yield* createBucketIfNotExists(bucket);

		const objects = yield* sendListObjectsCommand({
			bucket,
			prefix,
		});

		if (!objects.Contents || objects.Contents.length === 0) {
			return;
		}

		yield* Effect.forEach(
			objects.Contents,
			(object) =>
				Effect.gen(function* () {
					if (!object.Key) return;

					yield* sendDeleteObjectCommand({
						bucket,
						key: object.Key,
					});
				}),
			{
				concurrency: 10,
			},
		);
	});

const getObjectBytes = ({
	bucket,
	name,
}: {
	bucket: BucketName;
	name: string;
}) =>
	Effect.gen(function* () {
		const response = yield* sendGetObjectCommand({
			bucket,
			key: name,
		});

		const body = yield* Effect.fromNullable(response.Body).pipe(
			Effect.orElseFail(
				() =>
					new S3Error({
						operation: "getObjectBytes",
						cause: "empty_body",
					}),
			),
		);

		return yield* Effect.tryPromise({
			try: () => body.transformToByteArray(),
			catch: (cause) =>
				new S3Error({
					operation: "getObjectBytes",
					cause,
				}),
		});
	});

export const getMarkdownAsString = (input: {
	bucket: BucketName;
	name: string;
}) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("utf-8")),
	);

export const getImageAsBase64 = (input: { bucket: BucketName; name: string }) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("base64")),
	);
