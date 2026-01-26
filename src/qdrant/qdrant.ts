import { QdrantClient } from "@qdrant/qdrant-js";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { qdrantCollections } from "./qdrant-constants";

let client: QdrantClient | null = null;

const initCollectionIfNeeded = async (qdrant: QdrantClient) => {
	const collections = await qdrant.getCollections();
	const exists = collections.collections.some(
		(c) => c.name === qdrantCollections.asset.name,
	);

	if (!exists) {
		await qdrant.createCollection(qdrantCollections.asset.name, {
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

		await qdrant.createPayloadIndex(qdrantCollections.asset.name, {
			field_name: qdrantCollections.asset.index.blockId,
			field_schema: {
				type: "uuid",
				is_tenant: true,
			},
		});

		await qdrant.createPayloadIndex(qdrantCollections.asset.name, {
			field_name: qdrantCollections.asset.index.chunkIndex,
			field_schema: {
				type: "integer",
			},
		});

		logger.info(
			`[Qdrant] Collection '${qdrantCollections.asset.name}' created.`,
		);
	}
};

const getQdrantClient = async (): Promise<QdrantClient> => {
	if (client) return client;

	client = new QdrantClient({
		url: serverEnv.QDRANT_URL,
		port: null,
		apiKey: serverEnv.QDRANT_API_KEY,
	});

	// Init only once when client is first created
	await initCollectionIfNeeded(client);

	return client;
};

export const qdrant = await getQdrantClient();
