import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute(
	"/app/orgs/$orgId/providers/$providerSlug/",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { orgId, providerSlug } = Route.useParams();
	const { data: organizationProvider } = useSuspenseQuery(
		orpc.organizationProvider.find.queryOptions({
			input: { organizationId: orgId, providerSlug },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					{organizationProvider.data.providerSlug}
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/orgs/$orgId/providers/$providerSlug/edit"}
						params={{ orgId, providerSlug }}
						className={buttonVariants({ variant: "default" })}
					>
						Edit Provider
					</Link>
				</div>
			</div>
			<div className="flex justify-center">
				<Card className="max-w-full lg:w-[60%]">
					<CardContent className="p-4">
						<div className="space-y-2">
							<p>
								<strong>Provider:</strong>{" "}
								{organizationProvider.data.providerSlug}
							</p>
							<p>
								<strong>Enabled:</strong>{" "}
								{organizationProvider.data.enabled ? "Yes" : "No"}
							</p>
							<p>
								<strong>Created:</strong>{" "}
								{organizationProvider.data.createdAt?.toLocaleDateString()}
							</p>
							<p>
								<strong>Updated:</strong>{" "}
								{organizationProvider.data.updatedAt?.toLocaleDateString()}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
