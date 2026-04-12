import { basename } from "node:path";
import { sendGetObjectCommand } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { ProcessError } from "../errors";
import type {
	ProcessBytesSource,
	ProcessS3Source,
	ProcessSource,
} from "./types";

const normalizeMimeType = (mimeType: string | null | undefined) =>
	mimeType?.split(";")[0]?.trim().toLowerCase() ?? null;

const readS3Object = (source: ProcessS3Source) =>
	Effect.gen(function* () {
		const response = yield* sendGetObjectCommand({
			bucket: source.bucket,
			key: source.key,
		});

		const body = yield* Effect.fromNullable(response.Body).pipe(
			Effect.orElseFail(
				() =>
					new ProcessError({
						operation: "readS3Object.emptyBody",
						cause: new Error("S3 object body was empty"),
					}),
			),
		);

		const data = yield* Effect.tryPromise({
			try: async () => Uint8Array.from(await body.transformToByteArray()),
			catch: (cause) =>
				new ProcessError({
					operation: "readS3Object.transformToByteArray",
					cause,
				}),
		});

		const mimeType = normalizeMimeType(source.mimeType ?? response.ContentType);

		if (!mimeType) {
			return yield* new ProcessError({
				operation: "readS3Object.resolveMimeType",
				cause: new Error(
					`No MIME type available for S3 object ${source.bucket}/${source.key}`,
				),
			});
		}

		return {
			kind: "bytes",
			data,
			mimeType,
			filename: source.filename ?? basename(source.key),
		} satisfies ProcessBytesSource;
	});

export const readSource = (source: ProcessSource) =>
	Effect.gen(function* () {
		switch (source.kind) {
			case "bytes":
				return {
					...source,
					mimeType: normalizeMimeType(source.mimeType) ?? source.mimeType,
				} satisfies ProcessBytesSource;
			case "s3":
				return yield* readS3Object(source);
		}
	});
