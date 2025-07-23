import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BuildingIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Organization } from "@/db/schema/organization";
import { authClient } from "@/lib/auth-client";
import { organizationQueryOptions } from "@/lib/query-options/organization";
import { userQueryOptions } from "@/lib/query-options/user";

export const Route = createFileRoute("/_pathlessLayout/select-organization")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({ to: "/login" });
		}
		if (context.auth.session.activeOrganizationId) {
			throw redirect({ to: "/app" });
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
				return "Organization selected successfully!";
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
				<h1 className="font-bold text-3xl tracking-tight">
					Choose Your Organization
				</h1>
				<p className="text-lg text-muted-foreground">
					Select an organization to continue to the application
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1">
				{organizations.data.map((organization) => (
					<button
						key={organization.id}
						type="button"
						className="group cursor-pointer text-left transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						onClick={() => handleOrganizationChange(organization)}
						aria-label={`Select ${organization.name} organization`}
					>
						<Card className="h-full">
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
											<BuildingIcon className="h-6 w-6 text-primary" />
										</div>
										<div className="space-y-1">
											<CardTitle className="text-xl transition-colors group-hover:text-primary">
												{organization.name}
											</CardTitle>
											{organization.slug && (
												<p className="text-muted-foreground text-sm">
													@{organization.slug}
												</p>
											)}
										</div>
									</div>
									<CardAction>
										<Button
											variant="outline"
											size="sm"
											className="transition-all group-hover:bg-primary group-hover:text-primary-foreground"
											tabIndex={-1}
										>
											Select
											<ChevronRightIcon className="ml-1 h-4 w-4" />
										</Button>
									</CardAction>
								</div>
							</CardHeader>
						</Card>
					</button>
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
