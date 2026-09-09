import { organizationInvitationIdSchema } from "@orcai/schema";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";
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

		if (!deps.inv) {
			return undefined;
		}

		const validation = await queryClient.query(
			orpc.organizationInvitation.validate.queryOptions({
				input: {
					id: deps.inv,
				},
				staleTime: "static",
			}),
		);

		return {
			invitationId: organizationInvitationIdSchema.parse(deps.inv),
			email: validation.data.email,
			validation: validation.data,
		};
	},
});

function RouteComponent() {
	const invitation = Route.useLoaderData();

	if (!invitation) {
		return (
			<Placeholder
				title="Registration is by invitation"
				description="Accounts are created from an invitation link. Ask an administrator of the organisation you want to join to invite your email address."
				Icon={MailIcon}
				actions={[
					{
						key: "login",
						label: "Go to sign in",
						linkProps: {
							to: "/login",
						},
					},
				]}
			/>
		);
	}

	if (!invitation.validation.isValid) {
		const isExpired = invitation.validation.reason === "expired";
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

	const organizationName = invitation.validation.organizationName;

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Create your account</CardTitle>
				<CardDescription>
					{organizationName
						? `${organizationName} invited you. Create your account to join.`
						: "Create a new account to continue."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div>
					<SignUpForm
						invitationId={invitation.invitationId}
						email={invitation.email ?? ""}
					/>
				</div>
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				<Link to={"/login"}>Already have an account?</Link>
			</CardFooter>
		</Card>
	);
}
