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
import { m } from "@/paraglide/messages";

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
					<CardTitle>{m.auth_reset_password_page_invalid_title()}</CardTitle>
					<CardDescription>
						{m.auth_reset_password_page_invalid_description()}
					</CardDescription>
				</CardHeader>
				<CardFooter>
					<Link to="/forgot-password">
						{m.auth_reset_password_page_request_link()}
					</Link>
				</CardFooter>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{m.auth_reset_password_page_title()}</CardTitle>
				<CardDescription>
					{m.auth_reset_password_page_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ResetPasswordForm token={token} />
			</CardContent>
		</Card>
	);
}
