import { DB, dbSchema } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { NextStepProvider } from "nextstepjs";
import { Header } from "@/components/app/header";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { AppSidebar } from "@/components/app/sidebar/app-sidebar";
import { NextStepTours } from "@/components/next-step/next-step-tours";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import { auth } from "@/lib/auth/auth";
import { runtime } from "@/lib/effect/runtime";

/** Recheck membership and clear an obsolete active organisation. */
const hasActiveOrganizationMembership = createServerFn({
	method: "GET",
}).handler(async () => {
	const { headers } = getRequest();
	const sessionData = await auth.api.getSession({
		headers,
	});
	if (!sessionData?.session.activeOrganizationId) {
		return false;
	}

	const { session } = sessionData;
	const organizationId = organizationIdSchema.parse(
		session.activeOrganizationId,
	);
	const userId = userIdSchema.parse(sessionData.user.id);

	return await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;

			const membership = yield* db.query.member.findFirst({
				where: {
					organizationId: {
						eq: organizationId,
					},
					userId: {
						eq: userId,
					},
				},
				columns: {
					id: true,
				},
			});

			if (membership) {
				return true;
			}

			yield* db
				.update(dbSchema.session)
				.set({
					activeOrganizationId: null,
				})
				.where(
					and(
						eq(dbSchema.session.id, session.id),
						eq(dbSchema.session.activeOrganizationId, organizationId),
					),
				);

			return false;
		}),
	);
});

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}

		if (!context.auth.session.activeOrganizationId) {
			throw redirect({
				to: "/select-organization",
				statusCode: 302,
			});
		}

		if (!(await hasActiveOrganizationMembership())) {
			throw redirect({
				to: "/select-organization",
				statusCode: 302,
			});
		}

		return {
			auth: {
				...context.auth,
				session: {
					...context.auth.session,
					activeOrganizationId: organizationIdSchema.parse(
						context.auth.session.activeOrganizationId,
					),
				},
			},
		};
	},
	component: RouteComponent,
	pendingComponent: LoadingPage,
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
