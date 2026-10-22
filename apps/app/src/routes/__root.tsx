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
import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import * as Effect from "effect/Effect";
import Cookies from "js-cookie";
import { type ReactNode, useState } from "react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import {
	parseTheme,
	THEME_COOKIE_NAME,
	ThemeProvider,
} from "@/components/app/theme-provider";
import { ConfirmDialogProvider } from "@/components/ui/dialog/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth/auth";
import { requiresTwoFactor } from "@/lib/auth/two-factor-policy";
import { runPromise } from "@/lib/effect/runtime";
import { AppConfigService } from "@/lib/effect/services/config";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import appCss from "@/styles/app.css?url";

const getSession = createServerFn({
	method: "GET",
}).handler(async () => {
	const { headers } = getRequest();
	const [sessionData, policy] = await Promise.all([
		auth.api.getSession({
			headers,
		}),
		runPromise(
			Effect.gen(function* () {
				const { config } = yield* AppConfigService;

				return config.auth.twoFactorPolicy;
			}),
		),
	]);

	return sessionData
		? {
				session: {
					...sessionData.session,
				},
				user: {
					...sessionData.user,
				},
				twoFactor: {
					/** The policy covers the user, who has no second factor yet. */
					setupRequired: requiresTwoFactor(policy, sessionData.user),
					/** The policy covers the user, so 2FA cannot be turned off. */
					enforced: requiresTwoFactor(policy, {
						role: sessionData.user.role,
						twoFactorEnabled: false,
					}),
				},
			}
		: null;
});

/** Read per request, so one image serves any deployment. */
const getPublicConfig = createServerFn({
	method: "GET",
}).handler(() =>
	runPromise(
		Effect.gen(function* () {
			const { publicConfig } = yield* AppConfigService;

			return publicConfig;
		}),
	),
);

const getThemePreference = createIsomorphicFn()
	.server(() => parseTheme(getCookie(THEME_COOKIE_NAME)))
	.client(() => parseTheme(Cookies.get(THEME_COOKIE_NAME)));

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async () => {
		const theme = getThemePreference();
		const session = await getSession();

		// Check if session and user actually exist
		if (!session?.session || !session?.user) {
			return {
				theme,
				auth: {
					isAuthenticated: false as const,
				},
			};
		}

		return {
			theme,
			auth: {
				isAuthenticated: true as const,
				session: session.session,
				user: session.user,
				twoFactor: session.twoFactor,
			},
		};
	},
	loader: () => getPublicConfig(),
	staleTime: Number.POSITIVE_INFINITY,
	head: ({ loaderData }) => ({
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
				content: "OrcAI",
			},
			...seo({
				title: "OrcAI",
				description: m.app_meta_description(),
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
				href: "/seo/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
				color: "#456789",
			},
			{
				rel: "icon",
				href: "/seo/favicon.ico",
				sizes: "16x16 32x32",
			},
		],
		scripts: loaderData?.umami
			? [
					{
						src: loaderData.umami.scriptUrl,
						defer: true,
						"data-website-id": loaderData.umami.websiteId,
					},
				]
			: [],
	}),
	shellComponent: RootComponent,
	pendingComponent: LoadingPage,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const theme = Route.useRouteContext({
		select: (context) => context.theme,
	});
	// Later navigations re-read the cookie; <html> keeps what the server rendered.
	const [initialTheme] = useState(theme);
	const serverTheme = initialTheme === "system" ? undefined : initialTheme;

	return (
		<html
			className={serverTheme}
			lang={getLocale()}
			style={
				serverTheme
					? {
							colorScheme: serverTheme,
						}
					: undefined
			}
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
			</head>
			<body
				className={cn(
					"flex min-h-svh flex-col bg-background font-sans antialiased",
				)}
			>
				<ConfirmDialogProvider>
					<ThemeProvider initialTheme={initialTheme}>
						<TooltipProvider>
							{children}

							<Toaster
								mobilePosition="top-right"
								mobileOffset={{
									top: "60px",
								}}
							/>
							<TanStackDevtools
								config={{
									position: "bottom-right",
									panelLocation: "bottom",
									openHotkey: [
										"Meta",
										"Shift",
										"A",
									],
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
