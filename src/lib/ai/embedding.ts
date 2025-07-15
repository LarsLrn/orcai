import { embed } from "ai";
import { getSaiaEmbeddingModel } from "./saia-models";

export const generateEmbedding = async (value: string): Promise<number[]> => {
	const input = value.replaceAll("\\n", " ");
	const { embedding } = await embed({
		model: getSaiaEmbeddingModel({ model: "e5-mistral-7b-instruct" }).provider,
		value: input,
	});

	return embedding;
};
