import type { Group } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	useDeleteGroupsMutation,
	useUpdateGroupMutation,
} from "@/hooks/mutations/use-group-mutations";

const GroupSettingsForm = ({ group }: { group: Group }) => {
	const navigate = useNavigate();
	const [name, setName] = useState(group.name);
	const [description, setDescription] = useState(group.description ?? "");

	const updateGroup = useUpdateGroupMutation();
	const deleteGroup = useDeleteGroupsMutation(
		{
			onSuccess: async () => {
				await navigate({
					to: "/app/groups",
				});
			},
		},
		{
			names: [
				group.name,
			],
		},
	);

	const isSystemGroup = group.kind === "system";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Group settings</CardTitle>
				<CardDescription>
					System groups cannot be renamed or deleted.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					<Label htmlFor="group-name">Name</Label>
					<Input
						id="group-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						disabled={isSystemGroup}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="group-description">Description</Label>
					<Textarea
						id="group-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						disabled={isSystemGroup}
						rows={3}
					/>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() =>
							updateGroup.mutate({
								id: group.id,
								name: name.trim(),
								description: description.trim() ? description.trim() : null,
							})
						}
						disabled={isSystemGroup || !name.trim() || updateGroup.isPending}
					>
						Save
					</Button>
					{!isSystemGroup && (
						<Button
							variant="destructive"
							onClick={() =>
								deleteGroup.mutate({
									refs: [
										{
											id: group.id,
										},
									],
								})
							}
						>
							<Trash2Icon />
							Delete Group
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export { GroupSettingsForm };
