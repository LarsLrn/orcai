import { buckets } from "@orcai/core";
import {
	getObjectAsString,
	isS3NoSuchKey,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
	buildStoredExtractionKey,
	serializeStoredExtractionArtifact,
} from "./storage";
import type { StoredExtractionArtifact } from "./types";

/** A stored extraction that is gone, or not one this version can read. */
class StoredExtractionError extends Data.TaggedError("StoredExtractionError")<{
	readonly reason: "missing" | "invalid";
	readonly cause: unknown;
}> {}

const optionalNullable = <S extends Schema.Top>(schema: S) =>
	Schema.optional(Schema.NullOr(schema));

const Strings = Schema.Array(Schema.String);

/**
 * The fields readers dereference, nested ones included; the rest is the
 * extractor's own. The writer's type must satisfy it.
 */
const StoredExtraction = Schema.Struct({
	content: Schema.String,
	mimeType: Schema.String,
	metadata: Schema.Struct({
		title: optionalNullable(Schema.String),
		subject: optionalNullable(Schema.String),
		authors: optionalNullable(Strings),
		keywords: optionalNullable(Strings),
		pageCount: Schema.optional(Schema.Number),
		page_structure: optionalNullable(
			Schema.Struct({
				totalCount: Schema.Number,
			}),
		),
	}),
	tables: Schema.Array(Schema.Unknown),
	detectedLanguages: Strings,
	chunks: Schema.Array(
		Schema.Struct({
			content: Schema.String,
			metadata: Schema.Struct({
				chunkIndex: Schema.Number,
				totalChunks: Schema.Number,
				tokenCount: optionalNullable(Schema.Number),
				firstPage: optionalNullable(Schema.Number),
				lastPage: optionalNullable(Schema.Number),
				headingContext: optionalNullable(
					Schema.Struct({
						headings: Schema.Array(
							Schema.Struct({
								level: Schema.Number,
								text: Schema.String,
							}),
						),
					}),
				),
			}),
		}),
	),
	processingWarnings: Schema.Array(Schema.Unknown),
	images: Schema.Array(
		Schema.Struct({
			format: Schema.String,
			pageNumber: optionalNullable(Schema.Number),
			sourcePath: Schema.optional(Schema.String),
			text: optionalNullable(Schema.String),
		}),
	),
	metadataSuggestion: Schema.optional(
		Schema.Struct({
			title: Schema.String,
			description: Schema.String,
			language: Schema.optional(Schema.String),
		}),
	),
});

const invalid = (cause: unknown) =>
	new StoredExtractionError({
		reason: "invalid",
		cause,
	});

/** The asset's stored extraction, checked before anything reads it. */
export const readStoredExtraction = (assetId: string) =>
	Effect.gen(function* () {
		const text = yield* getObjectAsString({
			bucket: buckets.processed.name,
			name: buildStoredExtractionKey(assetId),
		}).pipe(
			Effect.catchIf(isS3NoSuchKey, (cause) =>
				Effect.fail(
					new StoredExtractionError({
						reason: "missing",
						cause,
					}),
				),
			),
		);
		const parsed: unknown = yield* Effect.try({
			try: () => JSON.parse(text),
			catch: invalid,
		});
		yield* Schema.decodeUnknownEffect(StoredExtraction)(parsed).pipe(
			Effect.mapError(invalid),
		);
		return parsed as StoredExtractionArtifact;
	});

export const writeStoredExtraction = (
	assetId: string,
	artifact: StoredExtractionArtifact,
) =>
	sendPutObjectCommand({
		bucket: buckets.processed.name,
		key: buildStoredExtractionKey(assetId),
		body: Buffer.from(
			serializeStoredExtractionArtifact(
				artifact satisfies typeof StoredExtraction.Type,
			),
			"utf-8",
		),
		contentType: "application/json",
	}).pipe(Effect.asVoid);
