import { createFileRoute, Link } from "@tanstack/react-router";
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
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
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
				<Link to="/login">{m.auth_forgot_password_page_signin_link()}</Link>
			</CardFooter>
		</Card>
	);
}
