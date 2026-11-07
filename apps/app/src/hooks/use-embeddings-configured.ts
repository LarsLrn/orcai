import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

const REBUILD_POLL_MS = 60_000;

/** Whether embeddings are set up or rebuilding. `/app` loads it, so the server renders with it. */
export const embeddingsStatusQuery = () =>
	orpc.instanceSettings.embeddingsStatus.queryOptions({
		input: {},
	});

/** Whether files can be indexed: false until an instance admin sets embeddings up, true while unknown. */
export const useEmbeddingsConfigured = () => {
	const { data } = useQuery(embeddingsStatusQuery());
	return data?.data.configured ?? true;
};

/** Whether files are being re-embedded, so search finds only some; checked every minute while in use. */
export const useEmbeddingsRebuilding = () => {
	const { data } = useQuery({
		...embeddingsStatusQuery(),
		refetchInterval: REBUILD_POLL_MS,
	});
	return data?.data.rebuilding ?? false;
};
