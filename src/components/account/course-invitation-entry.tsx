import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BookMarkedIcon, CalendarIcon, Clock4Icon } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type { CourseInvitation } from "@/lib/orpc/schemas/course-invitations";
import { courseQueryOptions } from "@/lib/query-options/course";
import { CourseInvitationActions } from "./course-invitation-actions";

const CourseInvitationContent = ({
	invitation,
}: {
	invitation: CourseInvitation;
}) => {
	const { data: course, status } = useQuery(
		courseQueryOptions.find({
			input: { id: invitation.courseId },
		}),
	);

	const isPending = invitation.status === "pending";

	if (status === "pending") {
		return <LoadingSpinner />;
	}

	if (!course?.data) {
		return (
			<Card className="w-full">
				<CardHeader className="pb-2">
					<CardTitle>Unknown Course</CardTitle>
				</CardHeader>
				<CardContent>
					<p>No course data available.</p>
				</CardContent>
			</Card>
		);
	}

	const { title, description } = course.data;

	return (
		<Card className="w-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<BookMarkedIcon className="h-4 w-4 text-primary" />
						<CardTitle className="text-lg">
							{title || "Unknown Course"}
						</CardTitle>
					</div>
					<Badge
						variant={
							invitation.status === "pending"
								? "outline"
								: invitation.status === "accepted"
									? "default"
									: "destructive"
						}
					>
						{invitation.status.charAt(0).toUpperCase() +
							invitation.status.slice(1)}
					</Badge>
				</div>
				<CardDescription className="line-clamp-2">
					{description || "No description available"}
				</CardDescription>
			</CardHeader>
			<CardContent className="py-2">
				<div className="flex flex-col text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<CalendarIcon className="h-3.5 w-3.5" />
						<span>
							Invited on {format(invitation.createdAt || "", "MMM d, yyyy")}
						</span>
					</div>
					{isPending && (
						<div className="mt-1 flex items-center gap-2 text-muted-foreground">
							<Clock4Icon className="h-3.5 w-3.5" />
							<span>
								Expires on {format(invitation.expiresAt, "MMM d, yyyy")}
							</span>
						</div>
					)}
				</div>
			</CardContent>

			{isPending && (
				<CardFooter>
					<CardAction>
						<CourseInvitationActions invitation={invitation} />
					</CardAction>
				</CardFooter>
			)}
		</Card>
	);
};

export function CourseInvitationEntry({
	invitation,
}: {
	invitation: CourseInvitation;
}) {
	return (
		<Suspense
			fallback={
				<Card className="w-full">
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<Skeleton className="h-5 w-1/3" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="mt-2 h-4 w-full" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="mt-2 h-4 w-1/2" />
					</CardContent>
					<CardFooter>
						<Skeleton className="h-8 w-1/3" />
					</CardFooter>
				</Card>
			}
		>
			<CourseInvitationContent invitation={invitation} />
		</Suspense>
	);
}
