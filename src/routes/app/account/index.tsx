import { createFileRoute, Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { Suspense } from "react";
import { ExportChats } from "@/components/account/export-chats";
import { UserStats } from "@/components/app/user-stats";
import { ChangePasswordForm } from "@/components/auth/change-password/change-password-form";
import { OrganizationInvitationsList } from "@/components/organizations/invitations/organization-invitations-list";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/users/profile/form/profile-form";

export const Route = createFileRoute("/app/account/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Account</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
					<div className="flex flex-1 flex-col gap-4">
						<Suspense fallback={<Skeleton className="h-21.5 w-full" />}>
							<UserStats />
						</Suspense>
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
								<CardTitle>Chat Usage</CardTitle>
								<CardDescription>
									Your chat usage statistics. This may include deleted messages
									and chats.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Suspense fallback={<Skeleton className="h-30 w-full" />}>
									<ExportChats />
								</Suspense>
							</CardContent>
						</Card>
					</div>

					<div className="flex flex-1 flex-col gap-4">
						<Card>
							<CardHeader>
								<CardTitle>Your Profile</CardTitle>
								<CardDescription>
									Adjust your profile information
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<ProfileForm />
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Organisation Invitations</CardTitle>
								<CardDescription>
									Manage invitations to join organisations
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Suspense fallback={<Skeleton className="h-30 w-full" />}>
									<OrganizationInvitationsList mode="all" />
								</Suspense>
							</CardContent>
						</Card>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-xl">Legal</p>
					<div className="flex gap-2">
						<Link
							className={buttonVariants({
								variant: "outline",
							})}
							to={"/privacy"}
							target="_blank"
						>
							<FileTextIcon /> Privacy Policy
						</Link>
						<Link
							className={buttonVariants({
								variant: "outline",
							})}
							to={"/tou"}
							target="_blank"
						>
							<FileTextIcon /> Terms of Use
						</Link>
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
