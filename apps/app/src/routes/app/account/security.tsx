import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordForm } from "@/components/auth/change-password/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContent } from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/account/security")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<PageContent className="flex max-w-2xl flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>{m.account_password_card_title()}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<ChangePasswordForm />
				</CardContent>
			</Card>
		</PageContent>
	);
}
