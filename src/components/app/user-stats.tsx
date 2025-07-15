import { skipToken, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	BookMarkedIcon,
	Building2Icon,
	MailIcon,
	SettingsIcon,
	UserIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/orpc";

const UserStats = ({
	showSettingsLink = false,
}: {
	showSettingsLink?: boolean;
}) => {
	const { data: activeOrganization } = authClient.useActiveOrganization();
	const { data: session } = authClient.useSession();

	const activeCourseId = session?.session.activeCourseId;

	const { data: activeCourse } = useQuery(
		orpc.course.find.queryOptions({
			input: activeCourseId ? { id: activeCourseId } : skipToken,
			queryKey: orpc.course.find.key({
				input: { id: activeCourseId ?? undefined },
			}),
		}),
	);

	return (
		<Card className="relative h-fit" id="tour-account">
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
					<UserIcon className="text-secondary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">Name</p>
						<p className="font-medium text-sm">{session?.user.name}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<MailIcon className="text-secondary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">Email</p>
						<p className="font-medium text-sm">{session?.user.email}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Building2Icon className="text-secondary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">Active Organisation</p>
						<p className="font-medium text-sm">
							{activeOrganization?.name || "No active organisation"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<BookMarkedIcon className="text-secondary" />
					<div className="space-y-0.5">
						<p className="text-muted-foreground text-xs">Active Course</p>
						<p className="font-medium text-sm">
							{activeCourse?.data.title || "No active course"}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export { UserStats };
