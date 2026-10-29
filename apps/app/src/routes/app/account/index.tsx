import { createFileRoute } from "@tanstack/react-router";
import { MailCheckIcon, MailWarningIcon } from "lucide-react";
import { UserStats } from "@/components/app/user-stats";
import { ProfilePictureSettings } from "@/components/images/image-settings";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageContent } from "@/components/ui/shell/page";
import { ProfileForm } from "@/components/users/profile/form/profile-form";
import { useResendVerificationEmail } from "@/hooks/mutations/use-resend-verification-email";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/account/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { mutate: resendVerificationEmail } = useResendVerificationEmail();

	return (
		<PageContent className="flex flex-col gap-4 lg:flex-row lg:items-start">
			<div className="flex flex-1 flex-col gap-4">
				<UserStats />
				<Card>
					<CardHeader>
						<CardTitle>{m.account_verification_card_title()}</CardTitle>
						<CardDescription className="flex items-center gap-2">
							{auth.user.emailVerified ? (
								<MailCheckIcon className="h-4 w-4 text-green-600" />
							) : (
								<MailWarningIcon className="h-4 w-4 text-amber-600" />
							)}
							{auth.user.emailVerified
								? m.account_verification_verified_description()
								: m.account_verification_unverified_description()}
						</CardDescription>
					</CardHeader>
					{!auth.user.emailVerified ? (
						<CardContent>
							<Button
								variant="outline"
								onClick={() =>
									resendVerificationEmail({
										email: auth.user.email,
									})
								}
							>
								{m.account_verification_send_button()}
							</Button>
						</CardContent>
					) : null}
				</Card>
			</div>

			<div className="flex flex-1 flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{m.account_profile_card_title()}</CardTitle>
						<CardDescription>
							{m.account_profile_card_description()}
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<ProfilePictureSettings user={auth.user} />
						<ProfileForm />
					</CardContent>
				</Card>
			</div>
		</PageContent>
	);
}
