import {
	CreateBucketCommand,
	HeadBucketCommand,
	type S3Client,
} from "@aws-sdk/client-s3";
import { buckets } from "@orcai/core";
import * as Effect from "effect/Effect";
import { getS3Code, getS3StatusCode, S3Error } from "./errors";

const isBucketNotFound = (cause: unknown) => {
	const statusCode = getS3StatusCode(cause);
	const code = getS3Code(cause);
	return statusCode === 404 || code === "NotFound" || code === "NoSuchBucket";
};

const isBucketConflict = (cause: unknown) => {
	const statusCode = getS3StatusCode(cause);
	const code = getS3Code(cause);
	return (
		statusCode === 409 ||
		code === "Conflict" ||
		code === "BucketAlreadyExists" ||
		code === "BucketAlreadyOwnedByYou"
	);
};

const send = (operation: string, request: () => Promise<unknown>) =>
	Effect.tryPromise({
		try: request,
		catch: (cause) =>
			new S3Error({
				operation,
				cause,
			}),
	});

/** Creates each bucket OrcAI uses that does not exist yet. */
export const createMissingBuckets = (client: S3Client) =>
	Effect.forEach(
		Object.values(buckets),
		({ name }) =>
			send("headBucket", () =>
				client.send(
					new HeadBucketCommand({
						Bucket: name,
					}),
				),
			).pipe(
				Effect.catchIf(
					(error) => isBucketNotFound(error.cause),
					() =>
						send("createBucket", () =>
							client.send(
								new CreateBucketCommand({
									Bucket: name,
								}),
							),
						).pipe(
							Effect.catchIf(
								(error) => isBucketConflict(error.cause),
								() => Effect.void,
							),
						),
				),
			),
		{
			discard: true,
		},
	);
