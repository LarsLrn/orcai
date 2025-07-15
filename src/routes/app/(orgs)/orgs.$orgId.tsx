import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(orgs)/orgs/$orgId")({
	loader: async ({ context: { queryClient }, params: { orgId } }) => {
		await queryClient.ensureQueryData(
			orpc.organization.find.queryOptions({
				input: { id: orgId },
				queryKey: orpc.organization.find.key({ input: { id: orgId } }),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { orgId } = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: { id: orgId },
			queryKey: orpc.organization.find.key({ input: { id: orgId } }),
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					{organization.data.name}
				</h4>
				<div className="flex gap-2">
					{/* <Link
						href={ROUTES.PRIVATE.organizations.members.getPath({ id })}
						className={buttonVariants({ variant: "default" })}
					>
						Manage Users
					</Link> */}
					<Link
						to={"/app/orgs/$orgId/edit"}
						params={{ orgId }}
						className={buttonVariants({ variant: "default" })}
					>
						Edit Organization
					</Link>
				</div>
			</div>
			<div className="flex justify-center">
				<Card className="max-w-full lg:w-[60%]">
					<CardContent className="p-4">
						{organization.data.id} | {organization.data.slug}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
