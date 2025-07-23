import { createFileRoute, Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { CourseInvitationsList } from "@/components/account/course-invitations-list";
import { ExportChats } from "@/components/account/export-chats";
import { UserStats } from "@/components/app/user-stats";
import { ProfileForm } from "@/components/forms/profile-form";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/account/")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Account",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Account
				</h4>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Suspense fallback={<Skeleton className="h-[86px] w-full" />}>
					<UserStats />
				</Suspense>
				<Card>
					<CardHeader>
						<CardTitle>Your Profile</CardTitle>
						<CardDescription>Adjust your profile information</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<ProfileForm />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Change Password</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<ChangePasswordForm />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Course Invitations</CardTitle>
						<CardDescription>Manage your course invitations</CardDescription>
					</CardHeader>
					<CardContent>
						<CourseInvitationsList />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Chat Usage</CardTitle>
						<CardDescription>
							Your chat usage statistics. This may include deleted messages and
							chats.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Suspense fallback={<Skeleton className="h-[120px] w-full" />}>
							<ExportChats />
						</Suspense>
					</CardContent>
				</Card>
			</div>
			<div className="flex flex-col gap-2">
				<p className="text-xl">Legal</p>
				<div className="flex gap-2">
					<Link
						className={buttonVariants({ variant: "outline" })}
						to={"/privacy"}
						target="_blank"
					>
						<FileTextIcon /> Privacy Policy
					</Link>
					<Link
						className={buttonVariants({ variant: "outline" })}
						to={"/tou"}
						target="_blank"
					>
						<FileTextIcon /> Terms of Use
					</Link>
				</div>
			</div>
		</div>
	);
}
