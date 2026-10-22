import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { TwoFactorEnrolment } from "@/components/auth/two-factor/two-factor-enrolment";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSignOut } from "@/hooks/actions/use-sign-out";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/setup-two-factor")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}

		if (!context.auth.twoFactor.setupRequired) {
			throw redirect({
				to: "/app",
				statusCode: 302,
			});
		}
	},
	head: () => ({
		meta: [
			{
				title: m.two_factor_setup_page_title(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { signOut } = useSignOut();

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{m.two_factor_setup_page_title()}</CardTitle>
				<CardDescription>
					{m.two_factor_setup_page_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<TwoFactorEnrolment
					onDone={() =>
						navigate({
							to: "/app",
						})
					}
				/>
			</CardContent>
			<CardFooter className="flex justify-end">
				<Button variant="link" onClick={signOut}>
					{m.account_user_menu_sign_out_action()}
				</Button>
			</CardFooter>
		</Card>
	);
}
