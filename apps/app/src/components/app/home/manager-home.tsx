import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { PanelSkeleton } from "@/components/ui/composed/panel";
import {
	PageAction,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import { ManageLibraryPanel } from "./manage-library-panel";
import { ManagePeoplePanel } from "./manage-people-panel";
import { ManageQuotaPanel } from "./manage-quota-panel";
import { ManageRecentPanel } from "./manage-recent-panel";

const OrganizationTitle = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);

	return <PageTitle>{organization.data.name}</PageTitle>;
};

const ManagerHome = () => (
	<div className="space-y-10">
		<PageHeader>
			<Suspense fallback={<Skeleton className="h-9 w-64 md:h-10" />}>
				<OrganizationTitle />
			</Suspense>
			<PageDescription>
				What this organisation has, what it is spending, and what changed.
			</PageDescription>
			<PageAction>
				<Link to="/app/hub/bots/add" className={buttonVariants()}>
					<SparklesIcon />
					Create a bot
				</Link>
			</PageAction>
		</PageHeader>

		<div className="grid gap-4 lg:grid-cols-3">
			<div className="lg:col-span-2">
				<Suspense fallback={<PanelSkeleton rows={3} />}>
					<ManageQuotaPanel />
				</Suspense>
			</div>
			<div>
				<Suspense fallback={<PanelSkeleton rows={4} />}>
					<ManageLibraryPanel />
				</Suspense>
			</div>
			<div className="lg:col-span-2">
				<Suspense fallback={<PanelSkeleton rows={6} />}>
					<ManageRecentPanel />
				</Suspense>
			</div>
			<div>
				<Suspense fallback={<PanelSkeleton rows={3} />}>
					<ManagePeoplePanel />
				</Suspense>
			</div>
		</div>
	</div>
);

export { ManagerHome };
