import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import { PasskeySignInButton } from "@/components/auth/passkey/passkey-sign-in-button";
import { SignInForm } from "@/components/auth/signin/signin-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/login")({
	// An invitation link's sign-in returns to the invitation.
	validateSearch: z.object({
		inv: z.string().optional(),
	}),
	loader: async ({ context: { queryClient } }) => {
		const status = await queryClient.query(
			orpc.bootstrap.status.queryOptions({
				input: {},
				staleTime: "static",
			}),
		);

		if (!status.data.initialized) {
			throw redirect({
				to: "/init",
				statusCode: 302,
			});
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { inv } = Route.useSearch();

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{m.auth_login_page_title()}</CardTitle>
				<CardDescription>{m.auth_login_page_description()}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<SignInForm />
				<div className="flex items-center gap-3 text-muted-foreground text-xs">
					<Separator className="flex-1" />
					{m.auth_login_page_or_separator()}
					<Separator className="flex-1" />
				</div>
				<PasskeySignInButton />
			</CardContent>
			<CardFooter className="flex justify-end text-muted-foreground text-sm">
				<Link
					to="/forgot-password"
					search={{
						inv,
					}}
				>
					{m.auth_login_page_forgot_password_link()}
				</Link>
			</CardFooter>
		</Card>
	);
}
