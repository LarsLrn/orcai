import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { CourseInvitationForm } from "@/components/courses/members/course-invitation-form";

export const Route = createFileRoute("/app/(users)/users/add")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<LoadingPage />}>
			<CourseInvitationForm />
		</Suspense>
	);
}
