import type { _Object as S3Object } from "@aws-sdk/client-s3";
import type { BucketName } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	sendDeleteObjectCommand,
	sendGetObjectCommand,
	sendListObjectsCommand,
} from "./commands";
import { S3Error } from "./errors";
import { createBucketIfNotExists } from "./upload-validation";

/** Every object under `prefix`, across all pages of the listing. */
export const listObjects = ({
	bucket,
	prefix,
}: {
	bucket: string;
	prefix: string;
}) =>
	Effect.gen(function* () {
		const objects: S3Object[] = [];
		let continuationToken: string | undefined;
		do {
			const page = yield* sendListObjectsCommand({
				bucket,
				prefix,
				continuationToken,
			});
			objects.push(...(page.Contents ?? []));
			continuationToken = page.IsTruncated
				? page.NextContinuationToken
				: undefined;
		} while (continuationToken);
		return objects;
	});

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

		const body = yield* Effect.fromNullishOr(response.Body).pipe(
			Effect.mapError(
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

export const getObjectAsString = (input: {
	bucket: BucketName;
	name: string;
}) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("utf-8")),
	);

export const getObjectAsJson = <T>(input: {
	bucket: BucketName;
	name: string;
}) =>
	getObjectAsString(input).pipe(
		Effect.map((content) => JSON.parse(content) as T),
	);

export const getImageAsBase64 = (input: { bucket: BucketName; name: string }) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("base64")),
	);
