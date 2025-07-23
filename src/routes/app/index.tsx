import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Suspense } from "react";
import { UserStats } from "@/components/app/user-stats";
import { UserWelcome } from "@/components/app/user-welcome";
import { ChatsPreview } from "@/components/chat/chats-preview";
import { OrganizationPreview } from "@/components/organizations/organization-preview";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { auth } = useRouteContext({ from: "/app" });

	return (
		<div className="space-y-8">
			<Suspense fallback={<Skeleton className="h-[68px] w-full" />}>
				<UserWelcome />
			</Suspense>

			<div className="mt-20 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
				{auth.session.activeOrganizationId && (
					<div className="flex flex-col gap-4 xl:col-span-3">
						<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
							<OrganizationPreview
								organizationId={auth.session.activeOrganizationId}
							/>
						</Suspense>
					</div>
				)}
				<div className="flex flex-col gap-4">
					<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
						<UserStats showSettingsLink />
					</Suspense>
				</div>
			</div>
			<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
				<ChatsPreview />
			</Suspense>
		</div>
	);
}
