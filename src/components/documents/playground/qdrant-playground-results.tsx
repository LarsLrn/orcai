import { useQuery } from "@tanstack/react-query";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { assetPointQueryOptions } from "@/lib/query-options/asset-point";
import type { QdrantPoint } from "@/types/qdrant";

const QdrantPlaygroundResults = ({ search }: { search: string }) => {
	const { data: points } = useQuery(
		assetPointQueryOptions.list({
			input: { filters: { search, limit: 10 } },
		}),
	);

	return (
		<div className="flex flex-col gap-4">
			{points?.data.map((point) => (
				<DisplayPoint key={point.id} point={point as QdrantPoint} />
			))}
		</div>
	);
};

export default QdrantPlaygroundResults;
