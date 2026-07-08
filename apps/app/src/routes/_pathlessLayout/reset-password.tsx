import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod/v4";
import { ResetPasswordForm } from "@/components/auth/reset-password/reset-password-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_pathlessLayout/reset-password")({
	validateSearch: z.object({
		token: z.string().optional(),
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token } = Route.useSearch();

	if (!token) {
		return (
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Invalid reset link</CardTitle>
					<CardDescription>
						Request a new password reset email to continue.
					</CardDescription>
				</CardHeader>
				<CardFooter>
					<Link to="/forgot-password">Request another link</Link>
				</CardFooter>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Choose a new password</CardTitle>
				<CardDescription>
					Use at least eight characters and enter the same password twice.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ResetPasswordForm token={token} />
			</CardContent>
		</Card>
	);
}
