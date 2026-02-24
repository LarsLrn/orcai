import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/_pathlessLayout/register")({
	component: RouteComponent,
	validateSearch: z.object({
		inv: z.string().optional(),
	}),
	loaderDeps: ({ search }) => ({
		inv: search.inv,
	}),
	loader: async ({ deps, context: { queryClient } }) => {
		const status = await queryClient.ensureQueryData(
			orpc.bootstrap.status.queryOptions({ input: {} }),
		);

		if (!status.data.initialized) {
			throw redirect({ to: "/init", statusCode: 302 });
		}

		if (!deps.inv) {
			return { query: undefined };
		}
	},
});

/* const _RegistrationDisabled = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<SimplePlaceholder className={className} {...props}>
			Registration is currently restricted. If you have been invited, please
			check your invitation link.
		</SimplePlaceholder>
	);
};

const _InvitationExpired = () => {
	return (
		<SimplePlaceholder Icon={CalendarXIcon}>
			Your invitation has expired. Please contact the administrator for a new
			invitation.
		</SimplePlaceholder>
	);
}; */

function RouteComponent() {
	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Sign Up</CardTitle>
				<CardDescription>Create a new account to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				{/* {query ? (
					<div>
						{query.expiresAt < new Date() ? (
							<InvitationExpired />
						) : (
							<SignUpForm invitation={query} />
						)}
					</div>
				) : (
					<RegistrationDisabled />
				)} */}
				{/* <SignUpForm invitation={query} /> */}
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				<Link to={"/login"}>Already have an account?</Link>
			</CardFooter>
		</Card>
	);
}
