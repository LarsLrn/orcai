import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import { UserHome } from "@/components/app/home/user-home";
import { showcaseBotsInput } from "@/components/bot/bots-showcase";
import {
	failingRequired,
	readinessQuery,
} from "@/components/readiness/organization-readiness-card";
import { orpc } from "@/lib/orpc/orpc";

const SUMMARY_PARAMS = {
	pageIndex: 0,
	pageSize: 1,
	filters: {
		origin: "library",
	},
} as const;

export const Route = createFileRoute("/app/_home/")({
	validateSearch: z.object({
		view: z.literal("use").optional().catch(undefined),
	}),
	// A turn fails until the required setup is done, so admins land on the
	// checklist by default. The Use tab asks for `?view=use` and is never redirected.
	beforeLoad: async ({
		context: { queryClient, isOrganizationAdmin },
		search,
	}) => {
		if (!isOrganizationAdmin || search.view === "use") {
			return;
		}
		const { data } = await queryClient.query(readinessQuery());
		if (failingRequired(data.checks) > 0) {
			throw redirect({
				to: "/app/manage",
				statusCode: 302,
			});
		}
	},
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: showcaseBotsInput(6),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.asset.list.queryOptions({
					input: SUMMARY_PARAMS,
					staleTime: "static",
				}),
			),
		]);
	},
	component: UserHome,
});
