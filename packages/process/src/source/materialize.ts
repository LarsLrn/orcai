import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { getFileTypeFromMime } from "@orcai/s3";
import * as Effect from "effect/Effect";
import { ProcessError } from "../errors";
import { readSource } from "./read";
import type { MaterializedProcessFile, ProcessSource } from "./types";

const sanitizeFilenamePart = (value: string) => {
	const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-");
	return sanitized.length > 0 ? sanitized : "source";
};

const buildFilename = (params: { filename?: string; mimeType: string }) => {
	const providedExtension = params.filename ? extname(params.filename) : "";
	const inferredFileType = getFileTypeFromMime(params.mimeType);
	const inferredExtension =
		inferredFileType === "unknown" ? "" : `.${inferredFileType}`;
	const extension = providedExtension || inferredExtension;
	const stem = params.filename
		? basename(params.filename, providedExtension)
		: "source";

	return `${sanitizeFilenamePart(stem)}${extension}`;
};

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

			const path = join(
				directory,
				buildFilename({
					filename: resolved.filename,
					mimeType: resolved.mimeType,
				}),
			);

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
