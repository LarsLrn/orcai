import { useRouteContext } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/users/user-avatar";
import { m } from "@/paraglide/messages";

const UserStats = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});

	return (
		<Card className="h-fit">
			<CardContent className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<UserAvatar user={auth.user} size="sm" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">
							{m.common_name_label()}
						</p>
						<p className="text-sm font-medium">{auth.user.name}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<MailIcon className="text-primary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">
							{m.common_email_label()}
						</p>
						<p className="text-sm font-medium">{auth.user.email}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export { UserStats };
