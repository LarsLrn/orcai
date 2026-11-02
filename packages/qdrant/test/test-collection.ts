import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ensureCollection } from "../src/collections";
import { EmbeddingGeneration, GenerationWrite } from "../src/generation";
import { QdrantLive, QdrantService } from "../src/service";

/**
 * A collection of the test's own as the generation point reads and writes run
 * on, gone when the layer is released. It embeds nothing.
 */
export const TestCollectionLive = (
	dimensions: number,
	qdrant: Layer.Layer<QdrantService, unknown> = QdrantLive,
) => {
	const collection = `orcai-test-${crypto.randomUUID()}`;
	return Layer.mergeAll(
		Layer.effect(
			EmbeddingGeneration,
			Effect.acquireRelease(
				Effect.gen(function* () {
					const { client } = yield* QdrantService;
					yield* ensureCollection(client, collection, dimensions);
					return EmbeddingGeneration.of({
						generation: 0,
						model: "test",
						dimensions,
						collection,
						embedQueries: () =>
							Effect.die(new Error("Test collections embed nothing")),
						embedPassages: () =>
							Effect.die(new Error("Test collections embed nothing")),
					});
				}),
				() =>
					QdrantService.pipe(
						Effect.flatMap(({ client }) =>
							Effect.promise(() => client.deleteCollection(collection)),
						),
					),
			),
		),
		Layer.succeed(GenerationWrite, {
			collection,
		}),
	).pipe(Layer.provideMerge(qdrant));
};
