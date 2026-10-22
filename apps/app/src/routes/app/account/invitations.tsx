import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { OrganizationInvitationsList } from "@/components/organizations/invitations/organization-invitations-list";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageContent } from "@/components/ui/shell/page";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/account/invitations")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<PageContent>
			<Card>
				<CardHeader>
					<CardTitle>{m.account_invitations_card_title()}</CardTitle>
					<CardDescription>
						{m.account_invitations_card_description()}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Suspense fallback={<Skeleton className="h-30 w-full" />}>
						<OrganizationInvitationsList mode="all" />
					</Suspense>
				</CardContent>
			</Card>
		</PageContent>
	);
}
