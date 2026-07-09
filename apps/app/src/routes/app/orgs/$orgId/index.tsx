import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
			input: {
				id: orgId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{organization.data.name}</PageTitle>
				<PageAction>
					<Link
						to="/app/orgs/$orgId/edit"
						params={{
							orgId,
						}}
						className={buttonVariants({
							variant: "default",
						})}
					>
						Edit Organisation
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Organisation Details</CardTitle>
							<CardDescription>
								Core organisation profile information.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="text-muted-foreground text-sm">Slug</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{organization.data.slug}
								</code>
							</div>
							{organization.data.logo ? (
								<>
									<Separator />
									<div className="flex items-start justify-between gap-4">
										<div className="text-muted-foreground text-sm">Logo</div>
										<span className="max-w-md truncate text-right text-sm">
											{organization.data.logo}
										</span>
									</div>
								</>
							) : null}
							{organization.data.metadata ? (
								<>
									<Separator />
									<div className="space-y-2">
										<div className="text-muted-foreground text-sm">
											Metadata
										</div>
										<pre className="overflow-auto rounded border bg-muted/40 p-3 text-xs">
											{organization.data.metadata}
										</pre>
									</div>
								</>
							) : null}
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<MetadataCard
						id={organization.data.id}
						createdAt={organization.data.createdAt}
					/>
				</div>
			</PageContent>
		</Page>
	);
}
