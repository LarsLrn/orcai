import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInForm } from "@/components/auth/signin/signin-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_pathlessLayout/login")({
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
			<CardFooter className="text-muted-foreground text-sm">
				<Link to={"/register"}>Create a new account?</Link>
			</CardFooter>
		</Card>
	);
}
