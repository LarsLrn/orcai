import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { UserStats } from "@/components/app/user-stats";
import { UserWelcome } from "@/components/app/user-welcome";
import { ChatsPreview } from "@/components/chat/chats-preview";
import { CoursePreview } from "@/components/courses/course-preview";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="space-y-8">
			<Suspense fallback={<Skeleton className="h-[68px] w-full" />}>
				<UserWelcome />
			</Suspense>

			<div className="mt-20 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
				<div className="flex flex-col gap-4 xl:col-span-3">
					<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
						<CoursePreview />
					</Suspense>
				</div>
				<div className="flex flex-col gap-4">
					<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
						<UserStats showSettingsLink />
					</Suspense>
				</div>
			</div>
			<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
				<ChatsPreview />
			</Suspense>
		</div>
	);
}
