import { Link, useRouteContext } from "@tanstack/react-router";
import { MailIcon, SettingsIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/users/user-avatar";
import { m } from "@/paraglide/messages";

const UserStats = ({
	showSettingsLink = false,
}: {
	showSettingsLink?: boolean;
}) => {
	const { auth } = useRouteContext({
		from: "/app",
	});

	return (
		<Card className="relative h-fit">
			{showSettingsLink && (
				<Link
					to={"/app/account"}
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
						className: "absolute top-2 right-2 size-8 text-muted-foreground",
					})}
				>
					<SettingsIcon />
				</Link>
			)}
			<CardContent className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<UserAvatar user={auth.user} size="sm" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">
							{m.common_name_label()}
						</p>
						<p className="font-medium text-sm">{auth.user.name}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<MailIcon className="text-primary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">
							{m.common_email_label()}
						</p>
						<p className="font-medium text-sm">{auth.user.email}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export { UserStats };
