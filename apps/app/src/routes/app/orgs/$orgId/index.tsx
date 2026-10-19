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
import { m } from "@/paraglide/messages";

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
						{m.orgs_edit_action()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>{m.orgs_detail_card_title()}</CardTitle>
							<CardDescription>
								{m.orgs_detail_card_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="text-muted-foreground text-sm">
									{m.orgs_detail_slug_label()}
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{organization.data.slug}
								</code>
							</div>
							{organization.data.logo ? (
								<>
									<Separator />
									<div className="flex items-start justify-between gap-4">
										<div className="text-muted-foreground text-sm">
											{m.orgs_detail_logo_label()}
										</div>
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
											{m.orgs_detail_metadata_label()}
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
