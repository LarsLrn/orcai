import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { getFileTypeFromMime } from "@orcai/s3";
import { sendGetObjectCommand } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { ProcessError } from "./errors";
import type {
	MaterializedProcessFile,
	ProcessBytesSource,
	ProcessSource,
} from "./types";

const normalizeMimeType = (mimeType: string | null | undefined) =>
	mimeType?.split(";")[0]?.trim().toLowerCase() ?? null;

const sanitizeFilenamePart = (value: string) => {
	const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-");
	return sanitized.length > 0 ? sanitized : "source";
};

const buildFilename = (source: ProcessBytesSource) => {
	const providedExtension = source.filename ? extname(source.filename) : "";
	const inferredFileType = getFileTypeFromMime(source.mimeType);
	const inferredExtension =
		inferredFileType === "unknown" ? "" : `.${inferredFileType}`;
	const extension = providedExtension || inferredExtension;
	const stem = source.filename
		? basename(source.filename, providedExtension)
		: "source";

	return `${sanitizeFilenamePart(stem)}${extension}`;
};

const readS3Object = (
	source: Extract<
		ProcessSource,
		{
			kind: "s3";
		}
	>,
) =>
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

export const withSourceFile = <A, E, R>(
	source: ProcessSource,
	handle: (file: MaterializedProcessFile) => Effect.Effect<A, E, R>,
) =>
	Effect.scoped(
		Effect.gen(function* () {
			const resolved = yield* readSource(source);

			const directory = yield* Effect.acquireRelease(
				Effect.tryPromise({
					try: () => mkdtemp(join(tmpdir(), "orcai-process-")),
					catch: (cause) =>
						new ProcessError({
							operation: "withSourceFile.mkdtemp",
							cause,
						}),
				}),
				(tempDirectory) =>
					Effect.ignore(
						Effect.tryPromise({
							try: () =>
								rm(tempDirectory, {
									recursive: true,
									force: true,
								}),
							catch: (cause) =>
								new ProcessError({
									operation: "withSourceFile.rm",
									cause,
								}),
						}),
					),
			);

			const path = join(directory, buildFilename(resolved));

			yield* Effect.tryPromise({
				try: () => writeFile(path, resolved.data),
				catch: (cause) =>
					new ProcessError({
						operation: "withSourceFile.writeFile",
						cause,
					}),
			});

			return yield* handle({
				path,
				mimeType: resolved.mimeType,
				filename: resolved.filename,
			});
		}),
	);
