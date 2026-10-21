import { randomUUID } from "node:crypto";
import type { ChatId } from "@orcai/core";
import { uploadAsset } from "../assets";
import type { ApiClient } from "../index";
import type { InferenceMock } from "../inference/fixture";
import { chatName } from "./chat";

const env = (name: string) => {
	const value = process.env[name];

	if (!value) {
		throw new Error(
			`${name} is not set. Run the suite through \`bun run stack e2e\`.`,
		);
	}

	return value;
};

const qdrant = (path: string, init: RequestInit) =>
	fetch(new URL(path, env("QDRANT_URL")), {
		...init,
		headers: {
			"api-key": env("QDRANT_API_KEY"),
			"content-type": "application/json",
		},
	}).then(async (response) => {
		if (!response.ok) {
			throw new Error(
				`Qdrant ${init.method} ${path}: ${response.status} ${await response.text()}`,
			);
		}
	});

/** The mock's vector for `text`, the same one the app's search embeds it to. */
const embedding = async (inference: InferenceMock, text: string) => {
	const response = await fetch(new URL("/v1/embeddings", inference.url), {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			input: text,
			dimensions: Number(env("EMBEDDING_DIMENSIONS")),
		}),
	});
	const body = (await response.json()) as {
		data: {
			embedding: number[];
		}[];
	};

	return body.data[0].embedding;
};

/**
 * A repository of the client's own, attached to the chat, holding one asset
 * with one indexed chunk that `query` finds. The suite runs no workers, so the
 * chunk goes into Qdrant directly; `remove` deletes it.
 */
export const repositoryWithChunk = async ({
	client,
	inference,
	chatId,
	query,
	text,
	page,
}: {
	client: ApiClient;
	inference: InferenceMock;
	chatId: ChatId;
	query: string;
	text: string;
	page: number;
}) => {
	const asset = await uploadAsset(client, chatName("Cited Asset"));
	const block = await client.block.create({
		type: "database",
		name: chatName("Cited Repository"),
		status: "ready",
		assets: [
			asset.id,
		],
		config: {
			minReferences: 1,
			maxReferences: 5,
			defaultReferences: 3,
			scoreThreshold: 0,
		},
	});
	await client.chatBlock.attach({
		chatId,
		blockId: block.data.id,
	});

	// A search opens the app's Qdrant service, which creates the collection on a reset stack.
	await client.assetPoint.searchRepository({
		repositoryId: block.data.id,
		filters: {
			queries: [
				query,
			],
			limit: 1,
		},
	});

	const pointId = randomUUID();
	const collection = `collections/orcai-chunks-${env("EMBEDDING_DIMENSIONS")}/points?wait=true`;
	await qdrant(collection, {
		method: "PUT",
		body: JSON.stringify({
			points: [
				{
					id: pointId,
					vector: {
						dense: await embedding(inference, query),
						bm25: {
							text,
							model: "qdrant/bm25",
							options: {
								language: "none",
								tokenizer: "multilingual",
								ascii_folding: true,
							},
						},
					},
					payload: {
						source: "text",
						asset_id: asset.id,
						block_id: block.data.id,
						text,
						title: asset.title,
						documentTotalPages: page + 1,
						chunkPageStart: page,
						chunkPageEnd: page,
						depth: 0,
						tokens: text.split(/\s+/).length,
						chunk_index: 0,
						chunkCount: 1,
						createdAt: new Date().toISOString(),
					},
				},
			],
		}),
	});

	return {
		title: asset.title,
		remove: () =>
			qdrant(
				`collections/orcai-chunks-${env("EMBEDDING_DIMENSIONS")}/points/delete?wait=true`,
				{
					method: "POST",
					body: JSON.stringify({
						points: [
							pointId,
						],
					}),
				},
			),
	};
};
