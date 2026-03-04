import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/orgs/$orgId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { orgId } = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: { id: orgId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{organization.data.name}</PageTitle>
				<PageAction>
					<Link
						to="/app/orgs/$orgId/edit"
						params={{ orgId }}
						className={buttonVariants({ variant: "default" })}
					>
						Edit Organization
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<Card className="max-w-full lg:w-[60%]">
					<CardContent className="p-4">
						{organization.data.id} | {organization.data.slug}
						<Outlet />
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
