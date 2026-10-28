import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

/** Needs a sign-in only, so a user without any membership still reaches their chats. */
export const Route = createFileRoute("/_pathlessLayout/history")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}

		if (context.auth.twoFactor.setupRequired) {
			throw redirect({
				to: "/setup-two-factor",
				statusCode: 302,
			});
		}
	},
	head: () => ({
		meta: [
			{
				title: m.chat_history_page_title(),
			},
		],
	}),
	component: Outlet,
});
