import type { RetrievalMode } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";

const QdrantPlaygroundResults = ({
	search,
	retrievalMode,
	repositoryId,
}: {
	search: string;
	retrievalMode?: RetrievalMode;
	repositoryId: string;
}) => {
	const {
		data: points,
		isPending,
		isError,
	} = useQuery(
		orpc.assetPoint.searchRepository.queryOptions({
			input: {
				repositoryId,
				filters: {
					queries: [
						search,
					],
					limit: 10,
					retrievalMode,
				},
			},
		}),
	);

	if (isPending) {
		return (
			<div className="flex min-h-48 items-center justify-center">
				<Spinner className="size-8" />
			</div>
		);
	}

	if (isError) {
		return (
			<Placeholder
				title="Search failed"
				description="The repository could not be searched. Please try again."
			/>
		);
	}

	if (!points || points.data.length === 0) {
		return (
			<Placeholder
				title="No matching content"
				description="Try a different query or retrieval mode."
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{points.data.map((point) => (
				<DisplayPoint key={point.id} point={point} />
			))}
		</div>
	);
};

export default QdrantPlaygroundResults;
