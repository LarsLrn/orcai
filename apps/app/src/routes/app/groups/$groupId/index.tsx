import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { SelectableListItem } from "@/components/ui/composed/selectable-list-item";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { Textarea } from "@/components/ui/textarea";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/groups/$groupId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { groupId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [memberSearch, setMemberSearch] = useState("");
	const [userSearch, setUserSearch] = useState("");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const group = useQuery(
		orpc.group.find.queryOptions({
			input: {
				id: groupId,
			},
		}),
	);
	const members = useQuery(
		orpc.group.listMembers.queryOptions({
			input: {
				groupId,
				pageIndex: 0,
				pageSize: 200,
				query: memberSearch.trim() ? memberSearch.trim() : undefined,
			},
		}),
	);
	const users = useQuery(
		orpc.user.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
			},
		}),
	);

	useEffect(() => {
		if (group.data?.data) {
			setName(group.data.data.name);
			setDescription(group.data.data.description ?? "");
		}
	}, [
		group.data?.data,
	]);

	const refreshGroupQueries = () => {
		queryClient.invalidateQueries({
			queryKey: orpc.group.key(),
		});
	};

	const updateGroup = useMutationAction({
		mutationOptions: () =>
			orpc.group.update.mutationOptions({
				onSuccess: refreshGroupQueries,
			}),
		messages: {
			loading: "Saving group...",
			success: "Group updated",
			error: "Failed to update group",
		},
	});

	const deleteGroup = useMutationAction({
		mutationOptions: () =>
			orpc.group.delete.mutationOptions({
				onSuccess: async () => {
					refreshGroupQueries();
					await navigate({
						to: "/app/groups",
					});
				},
			}),
		messages: {
			loading: "Deleting group...",
			success: "Group deleted",
			error: "Failed to delete group",
		},
		confirm: {
			title: "Delete group",
			description: "This revokes all grants tied to this group.",
			confirmText: "Delete",
			cancelText: "Cancel",
		},
	});

	const addMembers = useMutationAction({
		mutationOptions: () =>
			orpc.group.addMembers.mutationOptions({
				onSuccess: () => {
					refreshGroupQueries();
					setSelectedUserIds([]);
				},
			}),
		messages: {
			loading: "Adding members...",
			success: "Members added",
			error: "Failed to add members",
		},
	});

	const removeMembers = useMutationAction({
		mutationOptions: () =>
			orpc.group.removeMembers.mutationOptions({
				onSuccess: refreshGroupQueries,
			}),
		messages: {
			loading: "Removing members...",
			success: "Members removed",
			error: "Failed to remove members",
		},
		confirm: {
			title: "Remove members",
			description: "Selected users will be removed from this group.",
			confirmText: "Remove",
			cancelText: "Cancel",
		},
	});

	const memberIds = useMemo(
		() => new Set(members.data?.data.map((entry) => entry.user.id) ?? []),
		[
			members.data?.data,
		],
	);

	const availableUsers = useMemo(() => {
		const query = userSearch.trim().toLowerCase();
		return (users.data?.data ?? [])
			.filter((user) => !memberIds.has(user.id))
			.filter((user) => {
				if (!query) return true;
				return (
					user.name.toLowerCase().includes(query) ||
					user.email.toLowerCase().includes(query)
				);
			});
	}, [
		users.data?.data,
		memberIds,
		userSearch,
	]);

	if (!group.data?.data) {
		return (
			<Page>
				<PageContent className="py-10 text-center text-muted-foreground">
					Loading group...
				</PageContent>
			</Page>
		);
	}

	const isSystemGroup = group.data.data.kind === "system";

	return (
		<Page>
			<PageHeader>
				<PageTitle>{group.data.data.name}</PageTitle>
				<PageAction>
					<Badge variant={isSystemGroup ? "outline" : "secondary"}>
						{isSystemGroup ? "System" : "Custom"}
					</Badge>
				</PageAction>
			</PageHeader>

			<PageContent className="space-y-4">
				<Card>
					<CardHeader>
						<CardTitle>Group Settings</CardTitle>
						<CardDescription>System groups are immutable.</CardDescription>
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
										id: groupId,
										name: name.trim(),
										description: description.trim() ? description.trim() : null,
									})
								}
								disabled={
									isSystemGroup || !name.trim() || updateGroup.isPending
								}
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
													id: groupId,
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

				<Card>
					<CardHeader>
						<CardTitle>Members</CardTitle>
						<CardDescription>
							{isSystemGroup
								? "All organisation members are included implicitly."
								: "Manage explicit group membership."}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{!isSystemGroup && (
							<div className="space-y-3 rounded-lg border p-3">
								<div className="flex items-center gap-2">
									<UsersIcon className="h-4 w-4 text-muted-foreground" />
									<p className="font-medium text-sm">Add members</p>
								</div>
								<div className="relative max-w-sm">
									<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										className="pl-9"
										placeholder="Search users"
										value={userSearch}
										onChange={(event) => setUserSearch(event.target.value)}
									/>
								</div>
								<div className="max-h-56 space-y-1 overflow-auto rounded border p-1">
									{availableUsers.map((user) => {
										const isSelected = selectedUserIds.includes(user.id);
										return (
											<SelectableListItem
												key={user.id}
												option={{
													value: user.id,
													label: user.name,
													description: user.email,
												}}
												onSelect={(value) => {
													const id = value[0];
													setSelectedUserIds((current) =>
														current.includes(id)
															? current.filter((uid) => uid !== id)
															: [
																	...current,
																	id,
																],
													);
												}}
												isSelected={isSelected}
											/>
										);
									})}
									{availableUsers.length === 0 && (
										<p className="px-2 py-4 text-center text-muted-foreground text-sm">
											No available users found.
										</p>
									)}
								</div>
								<Button
									onClick={() =>
										addMembers.mutate({
											groupId,
											userIds: selectedUserIds,
										})
									}
									disabled={
										selectedUserIds.length === 0 || addMembers.isPending
									}
								>
									<PlusIcon />
									Add Selected
								</Button>
							</div>
						)}

						<div className="space-y-2">
							<div className="relative max-w-sm">
								<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									className="pl-9"
									placeholder="Filter members"
									value={memberSearch}
									onChange={(event) => setMemberSearch(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								{members.data?.data.map((entry) => (
									<div
										key={entry.user.id}
										className="flex items-center justify-between rounded-lg border p-3"
									>
										<div>
											<p className="font-medium text-sm">{entry.user.name}</p>
											<p className="text-muted-foreground text-xs">
												{entry.user.email}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Badge variant="outline">
												{entry.source === "implicit" ? "Implicit" : "Explicit"}
											</Badge>
											{!isSystemGroup && entry.source === "explicit" && (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														removeMembers.mutate({
															groupId,
															userIds: [
																entry.user.id,
															],
														})
													}
												>
													<Trash2Icon className="h-3.5 w-3.5" />
												</Button>
											)}
										</div>
									</div>
								))}
								{members.data && members.data.data.length === 0 && (
									<p className="rounded border border-dashed p-4 text-center text-muted-foreground text-sm">
										No members found.
									</p>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
