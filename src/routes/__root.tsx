/// <reference types="vite/client" />

import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ConfirmDialogProvider } from "@/components/ui/dialog/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import { clientEnv } from "@/lib/env/client";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";
import appCss from "@/styles/app.css?url";

const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getRequest();
	const sessionData = await auth.api.getSession({
		headers,
	});

	return sessionData
		? {
				session: { ...sessionData.session },
				user: { ...sessionData.user },
			}
		: null;
});

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async () => {
		const session = await getSession();

		// Check if session and user actually exist
		if (!session?.session || !session?.user) {
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
				user: session.user,
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
				src: clientEnv.VITE_UMAMI_SCRIPT_URL,
				defer: true,
				"data-website-id": clientEnv.VITE_UMAMI_WEBSITE_ID,
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
							<TanStackDevtools
								config={{
									position: "bottom-right",
									panelLocation: "bottom",
									openHotkey: ["Meta", "Shift", "A"],
								}}
								plugins={[
									{
										name: "TanStack Query",
										render: <ReactQueryDevtoolsPanel />,
									},
									{
										name: "TanStack Router",
										render: <TanStackRouterDevtoolsPanel />,
									},
									{
										name: "TanStack Form",
										render: <FormDevtoolsPanel />,
									},
								]}
							/>
							<Scripts />
						</TooltipProvider>
					</ThemeProvider>
				</ConfirmDialogProvider>
			</body>
		</html>
	);
}
