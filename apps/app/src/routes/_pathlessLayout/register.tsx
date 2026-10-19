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
import { m } from "@/paraglide/messages";

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
				title={m.auth_register_page_no_invitation_title()}
				description={m.auth_register_page_no_invitation_description()}
				Icon={MailIcon}
				actions={[
					{
						key: "login",
						label: m.auth_register_page_go_to_signin_action(),
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
				title={
					isExpired
						? m.auth_register_page_invitation_expired_title()
						: m.auth_register_page_invitation_not_found_title()
				}
				description={
					isExpired
						? m.auth_register_page_invitation_expired_description()
						: m.auth_register_page_invitation_not_found_description()
				}
			/>
		);
	}

	const organizationName = invitation.validation.organizationName;

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{m.auth_register_page_title()}</CardTitle>
				<CardDescription>
					{organizationName
						? m.auth_register_page_invited_description_named({
								organizationName,
							})
						: m.auth_register_page_invited_description()}
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
			<CardFooter className="flex-wrap gap-x-1 text-muted-foreground text-sm">
				{m.auth_register_page_signin_prompt()}
				<Link
					to={"/login"}
					className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
				>
					{m.auth_register_page_signin_link()}
				</Link>
			</CardFooter>
		</Card>
	);
}
