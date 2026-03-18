import { useQuery } from "@tanstack/react-query";
import { ListIcon } from "lucide-react";
import { useState } from "react";
import { JobListItem } from "@/components/jobs/job-list-item";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import type { JobQueue } from "@/lib/pg-boss/schema/job-queues";

type JobListDialogProps = {
	jobQueue: JobQueue;
	resourceId: string;
	resourceType: "block" | "asset";
	/** Optional filter to show only jobs for a specific asset within a block */
	assetIdFilter?: string;
};

const JobListDialog = ({
	jobQueue,
	resourceId,
	resourceType,
	assetIdFilter,
}: JobListDialogProps) => {
	const [open, setOpen] = useState(false);

	const { data, isLoading } = useQuery({
		...orpc.job.list.queryOptions({
			input: {
				jobQueue,
				resourceId,
				resourceType,
			},
		}),
		enabled: open,
		refetchInterval: (query) => {
			const jobs = query.state.data?.data;
			const hasActive = jobs?.some(
				(j) => j.state === "created" || j.state === "active",
			);
			return hasActive ? 5000 : false;
		},
	});

	const jobs = assetIdFilter
		? data?.data.filter(
				(j) => "assetId" in j.data && j.data.assetId === assetIdFilter,
			)
		: data?.data;

	return (
		<>
			<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
				<ListIcon className="mr-1 h-3 w-3" />
				Jobs
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[80vh] sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Job History</DialogTitle>
						<DialogDescription>
							{jobQueue} jobs for this resource
						</DialogDescription>
					</DialogHeader>
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Spinner className="size-6" />
						</div>
					) : jobs && jobs.length > 0 ? (
						<ScrollArea className="max-h-[55vh]">
							<div className="flex flex-col gap-2">
								{jobs.map((job) => (
									<JobListItem key={job.id} job={job} />
								))}
							</div>
						</ScrollArea>
					) : (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No jobs found.
						</p>
					)}
					<DialogFooter showCloseButton />
				</DialogContent>
			</Dialog>
		</>
	);
};

export { JobListDialog };
