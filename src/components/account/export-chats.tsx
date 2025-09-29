import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type {
	ApiGetScoresResponseData,
	ApiTraceWithDetails,
	ApiUtilsMetaResponse,
} from "langfuse";
import { auth } from "@/lib/auth";
import { langfuseServer } from "@/lib/langfuse/langfuse-server";
import { ExportChatsButton } from "./export-chats-button";
import { ExportChatsCSVButton } from "./export-chats-csv-button";

export type FilteredTrace = Pick<
	ApiTraceWithDetails,
	| "id"
	| "input"
	| "output"
	| "sessionId"
	| "timestamp"
	| "metadata"
	| "userId"
	| "tags"
	| "latency"
	| "observations"
> & {
	scores: ApiGetScoresResponseData[];
};

const fetchAllTraces = createServerFn({
	method: "GET",
}).handler(
	async (): Promise<{ meta: ApiUtilsMetaResponse; data: FilteredTrace[] }> => {
		const { headers } = getRequest();

		const session = await auth.api.getSession({ headers });

		if (!session?.user) {
			throw new Error("UNAUTHORIZED");
		}

		let allData: ApiTraceWithDetails[] = [];
		let currentPage = 1;
		let totalPages = 1;

		// Fetch first page to get total pages
		const firstPageResponse = await langfuseServer.api.traceList({
			userId: session.user.id,
			limit: 50,
			page: currentPage,
		});

		allData = [...firstPageResponse.data];
		totalPages = firstPageResponse.meta.totalPages;

		// Fetch remaining pages if any
		while (currentPage < totalPages) {
			currentPage++;
			const pageResponse = await langfuseServer.api.traceList({
				userId: session.user.id,
				limit: 50,
				page: currentPage,
			});
			allData = [...allData, ...pageResponse.data];
		}

		// Fetch scores
		const scores = await langfuseServer.api.scoreV2Get({
			userId: session.user.id,
		});

		// Filter traces to only include input and id properties
		const filteredData = allData
			.map((trace) => {
				if (!trace.tags?.includes("user")) {
					// Skip traces without the "user" tag
					return undefined;
				}
				const traceScores = scores.data.filter((score) => {
					return score.traceId === trace.id;
				});

				return {
					id: trace.id,
					input: trace.input,
					output: trace.output,
					sessionId: trace.sessionId,
					scores: traceScores,
					timestamp: trace.timestamp,
					metadata: trace.metadata,
					userId: trace.userId,
					tags: trace.tags,
					latency: trace.latency,
					observations: trace.observations,
				};
			})
			.filter((trace) => trace !== undefined) as FilteredTrace[];

		// Return the combined result with filtered data and final meta information
		return {
			data: filteredData,
			meta: {
				page: 1,
				limit: filteredData.length,
				totalItems: firstPageResponse.meta.totalItems,
				totalPages: 1,
			},
		};
	},
);

const calculateOverviewStats = (traces: FilteredTrace[]) => {
	const totalMessages = traces.length;

	// Count unique sessions (individual chats)
	const uniqueSessions = new Set(
		traces.map((trace) => trace.sessionId).filter(Boolean),
	).size;

	// Calculate date range
	const timestamps = traces
		.map((trace) => new Date(trace.timestamp))
		.filter((date) => !Number.isNaN(date.getTime()));
	const earliestDate =
		timestamps.length > 0
			? new Date(Math.min(...timestamps.map((d) => d.getTime())))
			: null;
	const latestDate =
		timestamps.length > 0
			? new Date(Math.max(...timestamps.map((d) => d.getTime())))
			: null;

	// Count traces with scores
	const tracesWithScores = traces.filter(
		(trace) => trace.scores && trace.scores.length > 0,
	).length;

	// Calculate average latency (excluding null/undefined values)
	const latencies = traces
		.map((trace) => trace.latency)
		.filter((latency) => latency != null && latency > 0);
	const averageLatency =
		latencies.length > 0
			? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
			: 0;

	// Count different tags
	const allTags = traces.flatMap((trace) => trace.tags || []);
	const uniqueTags = new Set(allTags);

	return {
		totalMessages,
		uniqueSessions,
		dateRange: {
			earliest: earliestDate,
			latest: latestDate,
		},
		tracesWithScores,
		averageLatency: Math.round(averageLatency),
		uniqueTags: Array.from(uniqueTags),
	};
};

const ExportChats = () => {
	const tracesFn = useServerFn(fetchAllTraces);

	const { data: traces } = useQuery({
		queryFn: () => tracesFn(),
		queryKey: ["export-chats"],
	});

	if (!traces || traces.data.length === 0) {
		return <div>No traces found.</div>;
	}

	const stats = calculateOverviewStats(traces.data);

	console.log("All Traces fetched:", traces.meta);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
				<div className="space-y-1">
					<p className="font-bold text-xl">
						{stats.totalMessages.toLocaleString()}
					</p>
					<p className="text-muted-foreground">Total Messages</p>
				</div>
				<div className="space-y-1">
					<p className="font-bold text-xl">
						{stats.uniqueSessions.toLocaleString()}
					</p>
					<p className="text-muted-foreground">Individual Chats</p>
				</div>
				<div className="space-y-1">
					<p className="font-bold text-xl">
						{stats.averageLatency > 0 ? `${stats.averageLatency}s` : "N/A"}
					</p>
					<p className="text-muted-foreground">Avg Response Time</p>
				</div>
				<div className="space-y-1">
					<p className="font-bold text-xl">
						{stats.tracesWithScores.toLocaleString()}
					</p>
					<p className="text-muted-foreground">With Scores</p>
				</div>
			</div>

			{stats.dateRange.earliest && stats.dateRange.latest && (
				<div className="mt-4 border-border border-t pt-4">
					<p className="text-muted-foreground text-sm">
						Data from {stats.dateRange.earliest.toLocaleDateString()} to{" "}
						{stats.dateRange.latest.toLocaleDateString()}
					</p>
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				<ExportChatsButton traces={traces.data} />
				<ExportChatsCSVButton traces={traces.data} />
			</div>
		</div>
	);
};

export { ExportChats };
