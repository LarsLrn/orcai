import { createFileRoute, Link } from "@tanstack/react-router";
import { VerifyEmailForm } from "@/components/auth/verify-email/verify-email-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/verify-email")({
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{m.auth_verify_email_page_title()}</CardTitle>
				<CardDescription>
					{m.auth_verify_email_page_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<VerifyEmailForm />
			</CardContent>
			<CardFooter>
				<Link to="/login">{m.auth_verify_email_page_signin_link()}</Link>
			</CardFooter>
		</Card>
	);
}
