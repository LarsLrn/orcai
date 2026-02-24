import type { Session } from "better-auth";
import {
	ChevronDownIcon,
	KeyIcon,
	LockIcon,
	MonitorIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShieldIcon,
	Trash2Icon,
	UserCogIcon,
	UserMinusIcon,
	UserXIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/auth-client";
import type { User } from "@/lib/orpc/schemas/user";

const ManageUser = ({
	user,
	courseRole,
	organizationRole,
}: {
	user: User;
	courseRole: string;
	organizationRole: string;
}) => {
	const [sessions, setSessions] = useState<Session[] | undefined>(undefined);
	const [isSessionsOpen, setIsSessionsOpen] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <FIXME: Check later>
	useEffect(() => {
		const getSessions = async () => {
			const sessions = await authClient.admin.listUserSessions({
				userId: user.id,
			});

			setSessions(sessions.data?.sessions);
		};

		getSessions();
	}, []);

	const handleChangePassword = async ({
		userId: _userId,
		password: _password,
	}: {
		userId: User["id"];
		password: string;
	}) => {
		/* toast.promise(updateUserPassword({ userId, password }), {
			loading: "Changing password...",
			success: "Password changed",
			error: (error) => ({
				message: "Failed to change password",
				description: error.message,
			}),
		}); */
	};

	const handleBanUser = (userId: string) => {
		toast.promise(authClient.admin.banUser({ userId }), {
			loading: "Banning user...",
			success: "User banned",
			error: (error) => ({
				message: "Failed to ban user",
				description: error.message,
			}),
		});
	};

	const handleUnbanUser = (userId: string) => {
		toast.promise(authClient.admin.unbanUser({ userId }), {
			loading: "Unbanning user...",
			success: "User unbanned",
			error: (error) => ({
				message: "Failed to unban user",
				description: error.message,
			}),
		});
	};

	const handleRevokeSession = (sessionToken: string) => {
		toast.promise(
			authClient.admin.revokeUserSession({
				sessionToken,
			}),
			{
				loading: "Revoking session...",
				success: "Session revoked",
				error: (error) => ({
					message: "Failed to revoke session",
					description: error.message,
				}),
			},
		);
	};

	const handleRoleChange = async (_role: "admin" | "member") => {
		/* toast.promise(
			updateUserOrganizationRole({ role, ids: [user.id] }),
			{
				loading: `Updating user role to ${role}...`,
				success: `User role updated to ${role}`,
				error: (error) => ({
					message: "Failed to update user role",
					description: error.message,
				}),
			},
		); */
	};

	const handleCourseRoleChange = async (_role: "instructor" | "student") => {
		/* toast.promise(
			updateUserCourseRole({ role, ids: [user.id] }),
			{
				loading: "Updating user role...",
				success: "User role updated",
				error: (error) => ({
					message: "Failed to update user role",
					description: error.message,
				}),
			},
		); */
	};

	const handleDeleteUser = (userId: string) => {
		toast.promise(authClient.admin.removeUser({ userId }), {
			loading: "Deleting user...",
			success: "User deleted",
			error: (error) => ({
				message: "Failed to delete user",
				description: error.message,
			}),
		});
	};

	return (
		<div className="flex flex-col gap-4">
			{/* User Status & Actions */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<UserCogIcon className="h-5 w-5 text-primary" />
							User Management
						</CardTitle>
						{user.banned && (
							<Badge variant="destructive" className="gap-1">
								<ShieldAlertIcon className="h-3 w-3" />
								Banned
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						{!user.banned ? (
							<Button
								variant="outline"
								className="gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
								onClick={() => handleBanUser(user.id)}
							>
								<UserXIcon className="h-4 w-4" />
								Ban User
							</Button>
						) : (
							<Button
								variant="outline"
								className="gap-2 border-green-500/50 text-green-600 hover:bg-green-500 hover:text-white dark:text-green-400"
								onClick={() => handleUnbanUser(user.id)}
							>
								<ShieldCheckIcon className="h-4 w-4" />
								Unban User
							</Button>
						)}

						<Button
							variant="outline"
							className="gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
							onClick={() => handleDeleteUser(user.id)}
						>
							<Trash2Icon className="h-4 w-4" />
							Delete User
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Roles Management */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldIcon className="h-5 w-5 text-primary" />
						Role Management
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-sm">Organization Role</span>
							<Badge variant="outline" className="capitalize">
								{organizationRole || "member"}
							</Badge>
						</div>
						<Select
							onValueChange={(value) =>
								handleRoleChange(value as "admin" | "member")
							}
							defaultValue={organizationRole || "member"}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="admin">
									<div className="flex items-center gap-2">
										<ShieldCheckIcon className="h-4 w-4 text-primary" />
										<span>Admin</span>
									</div>
								</SelectItem>
								<SelectItem value="member">
									<div className="flex items-center gap-2">
										<UserCogIcon className="h-4 w-4 text-muted-foreground" />
										<span>Member</span>
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-sm">Course Role</span>
							<Badge variant="outline" className="capitalize">
								{courseRole || "student"}
							</Badge>
						</div>
						<Select
							onValueChange={(value) =>
								handleCourseRoleChange(value as "instructor" | "student")
							}
							defaultValue={courseRole || "student"}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="instructor">
									<div className="flex items-center gap-2">
										<ShieldCheckIcon className="h-4 w-4 text-primary" />
										<span>Instructor</span>
									</div>
								</SelectItem>
								<SelectItem value="student">
									<div className="flex items-center gap-2">
										<UserCogIcon className="h-4 w-4 text-muted-foreground" />
										<span>Student</span>
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Security */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<LockIcon className="h-5 w-5 text-primary" />
						Security
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<p className="text-muted-foreground text-sm">
							Reset the user's password to a temporary value.
						</p>
						<Button
							variant="outline"
							className="gap-2"
							onClick={() =>
								handleChangePassword({
									userId: user.id,
									password: prompt("Enter new password") || "",
								})
							}
						>
							<KeyIcon className="h-4 w-4" />
							Change Password
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Active Sessions */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<MonitorIcon className="h-5 w-5 text-primary" />
							Active Sessions
						</CardTitle>
						{sessions && sessions.length > 0 && (
							<Badge variant="secondary">{sessions.length}</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{sessions && sessions.length > 0 ? (
						<Collapsible open={isSessionsOpen} onOpenChange={setIsSessionsOpen}>
							<CollapsibleTrigger
								render={
									<Button variant="outline" className="w-full gap-2">
										<span>{isSessionsOpen ? "Hide" : "Show"} Sessions</span>
										<ChevronDownIcon
											className={`h-4 w-4 transition-transform ${
												isSessionsOpen ? "rotate-180" : ""
											}`}
										/>
									</Button>
								}
							/>
							<CollapsibleContent className="mt-4">
								<ScrollArea className="max-h-96">
									<div className="flex flex-col gap-3">
										{sessions.map((session) => (
											<Card
												key={session.id}
												className="border-muted bg-muted/30"
											>
												<CardContent className="pt-4">
													<div className="space-y-3">
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0 flex-1 space-y-1">
																<p className="font-medium text-sm">
																	{new Date(
																		session.createdAt,
																	).toLocaleDateString("en-US", {
																		year: "numeric",
																		month: "short",
																		day: "numeric",
																		hour: "2-digit",
																		minute: "2-digit",
																	})}
																</p>
																<div className="space-y-0.5">
																	<p className="break-all text-muted-foreground text-xs">
																		<span className="font-medium">ID:</span>{" "}
																		{session.id}
																	</p>
																	<p className="break-all text-muted-foreground text-xs">
																		<span className="font-medium">IP:</span>{" "}
																		{session.ipAddress}
																	</p>
																	<p className="break-all text-muted-foreground text-xs">
																		<span className="font-medium">Agent:</span>{" "}
																		{session.userAgent}
																	</p>
																</div>
															</div>
														</div>
														<Button
															size="sm"
															variant="destructive"
															className="w-full gap-2"
															onClick={() => handleRevokeSession(session.token)}
														>
															<UserMinusIcon className="h-3 w-3" />
															Revoke Session
														</Button>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</ScrollArea>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<Placeholder
							title="No Active Sessions"
							description="There are no active sessions for this user."
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export { ManageUser };
