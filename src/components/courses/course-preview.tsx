"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookMarkedIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/orpc";

const CoursePreview = () => {
	const { data: sessionData } = authClient.useSession();

	const activeCourseId = sessionData?.session.activeCourseId;

	const {
		data: course,
		status,
		error,
	} = useQuery(
		orpc.course.find.queryOptions({
			input: activeCourseId ? { id: activeCourseId } : skipToken,
		}),
	);

	if (status === "pending") {
		return <LoadingSpinner className="h-8 w-8" />;
	}

	if (status === "error") {
		return <Placeholder>{error.message}</Placeholder>;
	}

	if (!course) {
		return <Placeholder>No such course</Placeholder>;
	}

	const { id, title, description } = course.data;

	return (
		<Card>
			<CardHeader className="flex flex-col justify-between sm:flex-row">
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-xs">Active Course</p>
					<CardTitle className="flex items-center gap-2">
						<BookMarkedIcon className="size-5" />
						{title}
					</CardTitle>
				</div>
				<Link
					to={"/app/courses/$courseId"}
					params={{ courseId: id }}
					className={buttonVariants({ variant: "outline", size: "sm" })}
				>
					About the course
				</Link>
			</CardHeader>
			<CardContent>{description}</CardContent>
		</Card>
	);
};

export { CoursePreview };
