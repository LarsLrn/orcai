import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { NextStepProvider } from "nextstepjs";
import { Header } from "@/components/app/header";
import { AppSidebar } from "@/components/app/sidebar/app-sidebar";
import { NextStepTours } from "@/components/next-step/next-step-tours";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import { organizationSelectSchema } from "@/lib/orpc/schemas/organization";

export const Route = createFileRoute("/app")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({ to: "/login", statusCode: 302 });
		}

		if (!context.auth.session.activeOrganizationId) {
			throw redirect({ to: "/select-organization", statusCode: 302 });
		}

		return {
			auth: {
				...context.auth,
				session: {
					...context.auth.session,
					activeOrganizationId: organizationSelectSchema.shape.id.parse(
						context.auth.session.activeOrganizationId,
					),
				},
			},
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { identifyUser } = useUmami();

	identifyUser(auth.user.id, {
		email: auth.user.email,
		name: auth.user.name,
	});

	return (
		<NextStepProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset className="max-w-full">
					<Header />
					<NextStepTours>
						<div className="z-10 mx-auto flex w-full flex-1 flex-col px-2 py-6 md:px-6">
							<Outlet />
						</div>
					</NextStepTours>
				</SidebarInset>
			</SidebarProvider>
		</NextStepProvider>
	);
}
