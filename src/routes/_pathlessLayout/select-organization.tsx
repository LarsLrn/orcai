import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BuildingIcon } from "lucide-react";
import { Suspense } from "react";
import { OrganizationInvitationsList } from "@/components/organizations/invitations/organization-invitations-list";
import { OrganizationCard } from "@/components/organizations/organization-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetActiveOrganizationMutation } from "@/hooks/mutations/use-user-mutations";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/_pathlessLayout/select-organization")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}
	},
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			orpc.organization.list.queryOptions({
				input: {
					pageIndex: 0,
					pageSize: 100,
				},
			}),
		);
	},
});

function PendingInvitationsSection({
	onAccepted,
}: {
	onAccepted: () => void | Promise<void>;
}) {
	return (
		<Card>
			<CardContent>
				<h2 className="font-semibold text-xl">
					Pending Organization Invitations
				</h2>
				<p className="mt-1 mb-4 text-muted-foreground text-sm">
					Accept an invitation to automatically join an organization.
				</p>
				<Suspense fallback={<Skeleton className="h-28 w-full" />}>
					<OrganizationInvitationsList
						mode="pending"
						onAccepted={onAccepted}
						emptyTitle="No Pending Invitations"
						emptyDescription="You currently don't have any pending invitations."
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}

function RouteComponent() {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();

	const { data: organizations } = useSuspenseQuery(
		orpc.organization.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);
	const { mutate: setActiveOrganization } = useSetActiveOrganizationMutation();

	const handleInvitationAccepted = async () => {
		await refetchSession();
		await navigate({
			to: "/app",
		});
	};

	return (
		<div className="w-full max-w-3xl space-y-6">
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-2xl tracking-tight">
					Select which organization you want to work with
				</h1>
				<p className="text-lg text-muted-foreground">
					You can always switch to a different organization later.
				</p>
			</div>

			{organizations.data.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
					{organizations.data.map((organization) => (
						<OrganizationCard
							key={organization.id}
							organization={organization}
							onSelect={() =>
								setActiveOrganization({
									organizationId: organization.id,
								})
							}
						/>
					))}
				</div>
			)}

			<PendingInvitationsSection onAccepted={handleInvitationAccepted} />

			{organizations.data.length === 0 && (
				<Card className="py-12 text-center">
					<CardContent>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<BuildingIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="mb-4 text-lg text-muted-foreground">
							No organizations available yet
						</p>
						<p className="text-muted-foreground text-sm">
							Accept an invitation above or contact your administrator to get
							access.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
