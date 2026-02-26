import { useQuery } from "@tanstack/react-query";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { orpc } from "@/lib/orpc/orpc";

const QdrantPlaygroundResults = ({ search }: { search: string }) => {
	const { data: points } = useQuery(
		orpc.assetPoint.list.queryOptions({
			input: { filters: { queries: [search], limit: 10 } },
		}),
	);

	return (
		<div className="flex flex-col gap-4">
			{points?.data.map((point) => (
				<DisplayPoint key={point.id} point={point} />
			))}
		</div>
	);
};

export default QdrantPlaygroundResults;
