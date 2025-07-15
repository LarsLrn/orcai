/* import "server-only"; */

import { QdrantClient } from "@qdrant/qdrant-js";
import { qdrantCollections } from "./qdrant-constants";

let client: QdrantClient | null = null;

const initCollectionIfNeeded = async (qdrant: QdrantClient) => {
	const collections = await qdrant.getCollections();
	const exists = collections.collections.some(
		(c) => c.name === qdrantCollections.chunks.name,
	);

	if (!exists) {
		await qdrant.createCollection(qdrantCollections.chunks.name, {
			vectors: {
				size: 4096,
				distance: "Cosine",
			},
			hnsw_config: {
				payload_m: 16,
				m: 0,
			},
			optimizers_config: {
				default_segment_number: 2,
			},
		});

		await qdrant.createPayloadIndex(qdrantCollections.chunks.name, {
			field_name: qdrantCollections.chunks.index.courseId,
			field_schema: {
				type: "uuid",
				is_tenant: true,
			},
		});

		await qdrant.createPayloadIndex(qdrantCollections.chunks.name, {
			field_name: qdrantCollections.chunks.index.chunkIndex,
			field_schema: {
				type: "integer",
			},
		});

		console.log(
			`[Qdrant] Collection '${qdrantCollections.chunks.name}' created.`,
		);
	}
};

const getQdrantClient = async (): Promise<QdrantClient> => {
	if (client) return client;

	client = new QdrantClient({
		url: process.env.QDRANT_URL,
		port: null,
		apiKey: process.env.QDRANT_API_KEY,
	});

	// Init only once when client is first created
	await initCollectionIfNeeded(client);

	return client;
};

export const qdrant = await getQdrantClient();
