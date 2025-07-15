import { createFileRoute, Outlet } from "@tanstack/react-router";
import { NextStepProvider } from "nextstepjs";
import { Header } from "@/components/app/header";
import { AppSidebar } from "@/components/app/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import { NextStepTours } from "@/lib/next-step-tours";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw new Error("User is not authenticated");
		}

		return {
			auth: context.auth,
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
				<SidebarInset className="h-dvh max-h-dvh max-w-full">
					<Header />
					<NextStepTours>
						<div className="z-10 mx-auto mt-14 flex w-full flex-1 flex-col px-2 py-6 md:px-6">
							<Outlet />
						</div>
					</NextStepTours>
				</SidebarInset>
			</SidebarProvider>
		</NextStepProvider>
	);
}
