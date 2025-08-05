import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ConfirmDialogProvider } from "@/components/ui/dialog/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import type { User } from "@/lib/orpc/schemas/user";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";
import appCss from "@/styles/app.css?url";

const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getWebRequest();
	const session = await auth.api.getSession({
		headers,
	});

	return session;
});

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session) {
			return {
				auth: {
					isAuthenticated: false as const,
				},
			};
		}

		return {
			auth: {
				isAuthenticated: true as const,
				session: session.session,
				user: session.user as User,
			},
		};
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "apple-mobile-web-app-title",
				content: "SokratesT",
			},
			...seo({
				title: "SokratesT",
				description: "Your AI Course Tutor",
			}),
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{ rel: "manifest", href: "/site.webmanifest", color: "#298fa2" },
			{ rel: "icon", href: "/seo/favicon.ico", sizes: "16x16 32x32" },
		],
		scripts: [
			{
				src: import.meta.env.VITE_UMAMI_SCRIPT_URL,
				defer: true,
				"data-website-id": import.meta.env.VITE_UMAMI_WEBSITE_ID,
			},
		],
	}),
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang={getLocale()} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className={cn("bg-background font-sans antialiased")}>
				<ConfirmDialogProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<TooltipProvider>
							{children}

							<Toaster
								mobilePosition="top-right"
								mobileOffset={{ top: "60px" }}
							/>
							<TanStackRouterDevtools position="bottom-right" />
							<ReactQueryDevtools buttonPosition="bottom-left" />
							<Scripts />
						</TooltipProvider>
					</ThemeProvider>
				</ConfirmDialogProvider>
			</body>
		</html>
	);
}
