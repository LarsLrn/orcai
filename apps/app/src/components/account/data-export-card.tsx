import type { DataExport } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestDataExportMutation } from "@/hooks/mutations/use-data-export-mutation";
import { orpc } from "@/lib/orpc/orpc";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

/** How often the status refreshes while an export is being prepared. */
const IN_FLIGHT_POLL_MS = 3000;

const isInFlight = (dataExport: DataExport | null | undefined) =>
	dataExport?.status === "pending" || dataExport?.status === "processing";

const statusText = (dataExport: DataExport) => {
	switch (dataExport.status) {
		case "pending":
		case "processing":
			return m.account_data_export_status_pending();
		case "ready":
			return m.account_data_export_status_ready({
				date: formatDisplayTimestamp(
					dataExport.completedAt ?? dataExport.createdAt,
				),
				size: formatFileSize(dataExport.size ?? 0),
				expiresAt: formatDisplayTimestamp(
					dataExport.expiresAt ?? dataExport.createdAt,
				),
			});
		case "failed":
			return m.account_data_export_status_failed();
		case "expired":
			return m.account_data_export_status_expired({
				date: formatDisplayTimestamp(
					dataExport.completedAt ?? dataExport.createdAt,
				),
			});
	}
};

export function DataExportCard() {
	const { data, isPending } = useQuery(
		orpc.dataExport.latest.queryOptions({
			input: {},
			refetchInterval: (query) =>
				isInFlight(query.state.data?.data) ? IN_FLIGHT_POLL_MS : false,
		}),
	);
	const { mutate: requestDataExport, isPending: requesting } =
		useRequestDataExportMutation();
	const dataExport = data?.data;
	const inFlight = isInFlight(dataExport);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.account_data_export_card_title()}</CardTitle>
				<CardDescription>
					{m.account_data_export_card_description()}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{isPending ? (
					<Skeleton className="h-5 w-full" />
				) : dataExport ? (
					<p
						className="flex items-center gap-2 text-sm"
						data-testid="data-export-status"
					>
						{inFlight ? (
							<LoaderCircleIcon className="size-4 animate-spin" />
						) : null}
						{statusText(dataExport)}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					{dataExport?.status === "ready" ? (
						<a
							className={buttonVariants()}
							href={`/api/data-exports/${dataExport.id}`}
							download
						>
							<DownloadIcon />
							{m.account_data_export_download_button()}
						</a>
					) : null}
					<Button
						variant="outline"
						disabled={isPending || inFlight || requesting}
						onClick={() => requestDataExport({})}
					>
						{m.account_data_export_request_button()}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
