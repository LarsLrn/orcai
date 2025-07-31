import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BuildingIcon } from "lucide-react";
import { toast } from "sonner";
import { OrganizationCard } from "@/components/organizations/organization-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Organization } from "@/db/schema/organization";
import { authClient } from "@/lib/auth-client";
import { organizationQueryOptions } from "@/lib/query-options/organization";
import { userQueryOptions } from "@/lib/query-options/user";

export const Route = createFileRoute("/_pathlessLayout/select-organization")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({ to: "/login", statusCode: 401 });
		}
	},
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			organizationQueryOptions.list({
				input: { pageIndex: 0, pageSize: 100 },
			}),
		);
	},
});

function RouteComponent() {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: organizations } = useSuspenseQuery(
		organizationQueryOptions.list({
			input: { pageIndex: 0, pageSize: 100 },
		}),
	);

	const { mutateAsync: setActiveOrganization } = useMutation(
		userQueryOptions.setActiveOrganization(queryClient),
	);

	const handleOrganizationChange = (organization: Organization) => {
		toast.promise(setActiveOrganization({ organizationId: organization.id }), {
			loading: `Switching to ${organization.name}...`,
			success: async () => {
				refetchSession();
				await navigate({ to: "/app" });
				return `Welcome to ${organization.name}!`;
			},
			error: (error) => ({
				message: "Failed to select organization",
				description: error.message,
			}),
		});
	};

	return (
		<div className="w-full max-w-2xl space-y-6">
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-2xl tracking-tight">
					Select which organization you want to work with
				</h1>
				<p className="text-lg text-muted-foreground">
					You can always switch to a different organization later.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
				{organizations.data.map((organization) => (
					<OrganizationCard
						key={organization.id}
						organization={organization}
						onSelect={() => handleOrganizationChange(organization)}
					/>
				))}
			</div>

			{organizations.data.length === 0 && (
				<Card className="py-12 text-center">
					<CardContent>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<BuildingIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="mb-4 text-lg text-muted-foreground">
							No organisations found
						</p>
						<p className="text-muted-foreground text-sm">
							Contact your administrator to get access to an organisation.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
