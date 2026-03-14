import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/app/groups/")({
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const groups = useQuery(
		orpc.group.list.queryOptions({
			input: {
				filters: {
					search,
				},
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);

	const createGroup = useMutationAction({
		mutationOptions: () =>
			orpc.group.create.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});
					setIsCreateOpen(false);
					setName("");
					setDescription("");
				},
			}),
		messages: {
			loading: "Creating group...",
			success: "Group created",
			error: "Failed to create group",
		},
	});

	const deleteGroup = useMutationAction({
		mutationOptions: () =>
			orpc.group.delete.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
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

	const onCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) {
			return;
		}

		createGroup.mutate({
			name: name.trim(),
			description: description.trim() ? description.trim() : null,
		});
	};

	return (
		<Page>
			<PageHeader>
				<PageTitle>Groups</PageTitle>
				<PageAction>
					<Button onClick={() => setIsCreateOpen(true)}>
						<PlusIcon className="mr-2 h-4 w-4" />
						Create Group
					</Button>
				</PageAction>
			</PageHeader>

			<PageContent className="space-y-4">
				<div className="relative max-w-sm">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search groups"
						className="pl-9"
					/>
				</div>

				<div className="rounded-lg border">
					<div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b px-4 py-2 font-medium text-sm">
						<div>Name</div>
						<div>Type</div>
						<div className="text-right">Actions</div>
					</div>
					{groups.isLoading && (
						<div className="px-4 py-8 text-center text-muted-foreground text-sm">
							Loading groups...
						</div>
					)}
					{groups.data?.data.map((group) => (
						<div
							key={group.id}
							className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"
						>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">{group.name}</p>
								{group.description && (
									<p className="truncate text-muted-foreground text-xs">
										{group.description}
									</p>
								)}
							</div>
							<div>
								<Badge
									variant={group.kind === "system" ? "outline" : "secondary"}
								>
									{group.kind === "system" ? "System" : "Custom"}
								</Badge>
							</div>
							<div className="flex items-center justify-end gap-2">
								<Link
									to="/app/groups/$groupId"
									params={{
										groupId: group.id,
									}}
									className={buttonVariants({
										variant: "outline",
										size: "sm",
									})}
								>
									<UsersIcon className="mr-1 h-3.5 w-3.5" />
									Manage
								</Link>
								{group.kind === "custom" && (
									<Button
										variant="outline"
										size="sm"
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
										<Trash2Icon className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						</div>
					))}
					{groups.data && groups.data.data.length === 0 && (
						<div className="px-4 py-8 text-center text-muted-foreground text-sm">
							No groups found.
						</div>
					)}
				</div>
			</PageContent>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Group</DialogTitle>
						<DialogDescription>
							Create a custom organization group for access management.
						</DialogDescription>
					</DialogHeader>

					<form className="space-y-4" onSubmit={onCreateSubmit}>
						<div className="space-y-2">
							<Label htmlFor="group-name">Name</Label>
							<Input
								id="group-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={120}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="group-description">Description</Label>
							<Textarea
								id="group-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								rows={3}
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsCreateOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={!name.trim() || createGroup.isPending}
							>
								Create
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Page>
	);
}
