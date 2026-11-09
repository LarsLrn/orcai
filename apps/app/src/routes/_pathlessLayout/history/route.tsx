import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ensureSignedIn } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

/** Needs a sign-in only, so a user without any membership still reaches their chats. */
export const Route = createFileRoute("/_pathlessLayout/history")({
	beforeLoad: ({ context }) => {
		ensureSignedIn(context.auth);
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
