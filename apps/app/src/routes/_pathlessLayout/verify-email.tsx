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

export const Route = createFileRoute("/_pathlessLayout/verify-email")({
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Check your email</CardTitle>
				<CardDescription>
					Use the verification link we sent before signing in. The message may
					take a few minutes to arrive.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<VerifyEmailForm />
			</CardContent>
			<CardFooter>
				<Link to="/login">Return to sign in</Link>
			</CardFooter>
		</Card>
	);
}
