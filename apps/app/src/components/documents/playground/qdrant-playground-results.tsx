import type { RetrievalMode } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
				title={m.assets_playground_error_title()}
				description={m.assets_playground_error_description()}
			/>
		);
	}

	if (!points || points.data.length === 0) {
		return (
			<Placeholder
				title={m.assets_playground_empty_state_title()}
				description={m.assets_playground_empty_state_description()}
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
