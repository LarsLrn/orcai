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

export const Route = createFileRoute("/_pathlessLayout/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Reset your password</CardTitle>
				<CardDescription>
					Enter your email address and we will send reset instructions if an
					account exists.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ForgotPasswordForm />
			</CardContent>
			<CardFooter>
				<Link to="/login">Return to sign in</Link>
			</CardFooter>
		</Card>
	);
}
