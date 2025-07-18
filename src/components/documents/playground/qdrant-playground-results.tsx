import { useQuery } from "@tanstack/react-query";
import { DisplayChunk } from "@/components/documents/chunks/display-chunk";
import { orpc } from "@/lib/orpc/orpc";
import type { QdrantChunk } from "@/types/qdrant";

const QdrantPlaygroundResults = ({ search }: { search: string }) => {
	const { data: points } = useQuery(
		orpc.assetPoints.list.queryOptions({
			// TODO: replace with actual courseId
			input: { courseId: "placeholder", filters: { search, limit: 10 } },
		}),
	);

	return (
		<div className="flex flex-col gap-4">
			{points?.data.map((point) => (
				<DisplayChunk key={point.id} chunk={point as QdrantChunk} />
			))}
		</div>
	);
};

export default QdrantPlaygroundResults;
