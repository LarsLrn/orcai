import * as Data from "effect/Data";

export class QdrantError extends Data.TaggedError("QdrantError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

/** The instance has no embedding endpoint yet, so nothing can be embedded or searched. */
export class EmbeddingsNotConfiguredError extends Data.TaggedError(
	"EmbeddingsNotConfiguredError",
) {}

/** A newer embedding generation replaced the one an operation started on. */
export class StaleEmbeddingGenerationError extends Data.TaggedError(
	"StaleEmbeddingGenerationError",
)<{
	readonly generation: number;
}> {}

/** Another embedding model or size re-embeds every file, which the caller did not confirm. */
export class EmbeddingModelChangeError extends Data.TaggedError(
	"EmbeddingModelChangeError",
)<{
	readonly model: string;
	readonly dimensions: number;
}> {}

/** Another save replaced the generation a confirmed model change was meant for. */
export class EmbeddingGenerationChangedError extends Data.TaggedError(
	"EmbeddingGenerationChangedError",
)<{
	readonly generation: number;
}> {}
