import { organizationIdSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { OrganizationProfilePage } from "@/components/organizations/organization-profile";
import { Page, PageContent } from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

const canEditOptions = (organizationId: string) =>
	orpc.authorization.check.queryOptions({
		input: {
			entityType: "organization",
			entityId: organizationId,
			permission: "manage_organization",
		},
	});

export const Route = createFileRoute("/app/organizations/$organizationId")({
	params: {
		parse: (params) => ({
			organizationId: parseParam(organizationIdSchema, params.organizationId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { organizationId } }) => {
		const [profile] = await Promise.all([
			orNotFound(
				queryClient.query(
					orpc.organization.profile.queryOptions({
						input: {
							id: organizationId,
						},
						staleTime: "static",
					}),
				),
			),
			queryClient.query({
				...canEditOptions(organizationId),
				staleTime: "static",
			}),
		]);
		return profile;
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.name,
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const { organizationId } = Route.useParams();
	const { auth } = Route.useRouteContext();
	const isActive = organizationId === auth.session.activeOrganizationId;
	const { data: profile } = useSuspenseQuery(
		orpc.organization.profile.queryOptions({
			input: {
				id: organizationId,
			},
		}),
	);
	const { data: canEdit } = useSuspenseQuery(canEditOptions(organizationId));

	return (
		<Page>
			<PageContent>
				<OrganizationProfilePage
					organization={profile.data}
					isActive={isActive}
					canEdit={canEdit.data.allowed}
				/>
			</PageContent>
		</Page>
	);
}
