import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import { TwoFactorChallengeForm } from "@/components/auth/two-factor/two-factor-challenge-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/two-factor")({
	// An invitation link's sign-in returns to the invitation.
	validateSearch: z.object({
		inv: z.string().optional(),
	}),
	beforeLoad: ({ context }) => {
		if (context.auth.isAuthenticated) {
			throw redirect({
				to: "/app",
				statusCode: 302,
			});
		}
	},
	head: () => ({
		meta: [
			{
				title: m.two_factor_challenge_page_title(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { inv } = Route.useSearch();

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{m.two_factor_challenge_page_title()}</CardTitle>
				<CardDescription>
					{m.two_factor_challenge_page_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<TwoFactorChallengeForm />
			</CardContent>
			<CardFooter className="flex justify-end text-muted-foreground text-sm">
				<Link
					to="/login"
					search={{
						inv,
					}}
				>
					{m.two_factor_challenge_back_link()}
				</Link>
			</CardFooter>
		</Card>
	);
}
