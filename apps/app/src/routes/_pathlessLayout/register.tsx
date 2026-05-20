import { organizationInvitationIdSchema } from "@orcai/schema";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import { SignUpForm } from "@/components/auth/signup/signup-form";
import { Placeholder } from "@/components/placeholders/placeholder";
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

		if (!deps.inv) {
			return undefined;
		}

		const validation = await queryClient.ensureQueryData(
			orpc.organizationInvitation.validate.queryOptions({
				input: {
					id: deps.inv,
				},
			}),
		);

		return {
			invitationId: organizationInvitationIdSchema.parse(deps.inv),
			validation: validation.data,
		};
	},
});

function RouteComponent() {
	const invitation = Route.useLoaderData();

	if (!invitation?.validation.isValid) {
		const isExpired = invitation?.validation.reason === "expired";
		return (
			<Placeholder
				title={isExpired ? "Invitation Expired" : "Invitation not found"}
				description={
					isExpired
						? "The invitation you are trying to access has expired."
						: "The invitation you are trying to access does not exist or has already been consumed."
				}
			/>
		);
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Sign Up</CardTitle>
				<CardDescription>Create a new account to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				<div>
					<SignUpForm invitationId={invitation.invitationId} />
				</div>
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				<Link to={"/login"}>Already have an account?</Link>
			</CardFooter>
		</Card>
	);
}
