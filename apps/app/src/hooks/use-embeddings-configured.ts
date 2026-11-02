import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

/** Whether files can be indexed: false until an instance admin sets embeddings up, true while unknown. */
export const useEmbeddingsConfigured = () => {
	const { data } = useQuery(
		orpc.instanceSettings.embeddingsStatus.queryOptions({
			input: {},
		}),
	);
	return data?.data.configured ?? true;
};
