import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SignInForm } from "@/components/auth/signin/signin-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/_pathlessLayout/login")({
	loader: async ({ context: { queryClient } }) => {
		const status = await queryClient.ensureQueryData(
			orpc.bootstrap.status.queryOptions({
				input: {},
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
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Login</CardTitle>
				<CardDescription>Sign in to your account to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				<SignInForm />
			</CardContent>
			<CardFooter className="flex justify-between text-muted-foreground text-sm">
				<Link to={"/register"}>Create a new account?</Link>
				<Link to={"/forgot-password"}>Forgot password?</Link>
			</CardFooter>
		</Card>
	);
}
