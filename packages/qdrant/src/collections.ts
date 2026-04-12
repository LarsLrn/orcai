import * as Effect from "effect/Effect";
import { QdrantConfigService } from "./config";

export interface QdrantCollections {
	readonly asset: {
		readonly name: string;
		readonly dimensions: number;
		readonly index: {
			readonly blockId: "block_id";
			readonly chunkIndex: "chunk_index";
			readonly chunkPageStart: "chunkPageStart";
			readonly chunkPageEnd: "chunkPageEnd";
		};
	};
}

export const qdrantCollections = Effect.gen(function* () {
	const { config } = yield* QdrantConfigService;

	return {
		asset: {
			name: `orcai-chunks-${config.embedding.dimensions}`,
			dimensions: config.embedding.dimensions,
			index: {
				blockId: "block_id",
				chunkIndex: "chunk_index",
				chunkPageStart: "chunkPageStart",
				chunkPageEnd: "chunkPageEnd",
			},
		},
	} satisfies QdrantCollections;
});
