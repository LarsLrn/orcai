import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod/v4";
import { ForgotPasswordForm } from "@/components/auth/forgot-password/forgot-password-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/forgot-password")({
	// An invitation link's sign-in returns to the invitation.
	validateSearch: z.object({
		inv: z.string().optional(),
	}),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { inv } = Route.useSearch();

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{m.auth_forgot_password_page_title()}</CardTitle>
				<CardDescription>
					{m.auth_forgot_password_page_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ForgotPasswordForm />
			</CardContent>
			<CardFooter>
				<Link
					to="/login"
					search={{
						inv,
					}}
				>
					{m.auth_forgot_password_page_signin_link()}
				</Link>
			</CardFooter>
		</Card>
	);
}
