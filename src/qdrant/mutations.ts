/* import "server-only"; */

import pMap from "p-map";
import type { Course } from "@/db/schema/course";
import type { Document } from "@/db/schema/document";
import type { ChunkPayload } from "@/types/qdrant";
import { qdrant } from "./qdrant";
import { qdrantCollections } from "./qdrant-constants";

interface Point {
	vector: number[];
	id: string;
	payload: ChunkPayload;
}

export const upsertChunksToQdrant = async ({ chunks }: { chunks: Point[] }) => {
	const points = chunks.map((chunk) => ({
		id: chunk.id,
		vector: chunk.vector,
		payload: chunk.payload,
	}));

	// TODO: Uploading chunks one by one is not optimal, but batching was flaking out
	// Specifically this:
	// return qdrant.upsert(qdrantCollections.chunks.name, { points });

	const saveChunk = async (point: Point) => {
		await qdrant.upsert(qdrantCollections.chunks.name, {
			points: [point],
		});
	};

	await pMap(points, saveChunk, { concurrency: 10 });
};

export const deleteChunksByDocumentId = async ({
	documentId,
	courseId,
}: {
	documentId: Document["id"];
	courseId: Course["id"];
}) => {
	return qdrant.delete(qdrantCollections.chunks.name, {
		filter: {
			must: [
				{
					key: qdrantCollections.chunks.index.courseId,
					match: {
						value: courseId,
					},
				},
				{
					key: "document_id",
					match: {
						value: documentId,
					},
				},
			],
		},
	});
};
