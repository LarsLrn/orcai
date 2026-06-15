import type { User } from "@orcai/schema";
import {
	ShieldAlertIcon,
	ShieldCheckIcon,
	Trash2Icon,
	UserCogIcon,
	UserXIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";
import { authClient } from "@/lib/auth/auth-client";

const ManageUser = ({ user }: { user: User }) => {
	const { mutate: deleteUsers } = useDeleteUsersMutation();

	const handleBanUser = (userId: string) => {
		toast.promise(
			authClient.admin.banUser({
				userId,
			}),
			{
				loading: "Banning user...",
				success: "User banned",
				error: (error) => ({
					message: "Failed to ban user",
					description: error.message,
				}),
			},
		);
	};

	const handleUnbanUser = (userId: string) => {
		toast.promise(
			authClient.admin.unbanUser({
				userId,
			}),
			{
				loading: "Unbanning user...",
				success: "User unbanned",
				error: (error) => ({
					message: "Failed to unban user",
					description: error.message,
				}),
			},
		);
	};

	const handleDeleteUser = (userId: string) => {
		deleteUsers({
			userIds: [
				userId,
			],
		});
	};

	return (
		<div className="flex flex-col gap-4">
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
								variant="destructive"
								onClick={() => handleBanUser(user.id)}
							>
								<UserXIcon className="h-4 w-4" />
								Ban User
							</Button>
						) : (
							<Button onClick={() => handleUnbanUser(user.id)}>
								<ShieldCheckIcon className="h-4 w-4" />
								Unban User
							</Button>
						)}

						<Button
							variant="destructive"
							onClick={() => handleDeleteUser(user.id)}
						>
							<Trash2Icon className="h-4 w-4" />
							Delete User
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export { ManageUser };
