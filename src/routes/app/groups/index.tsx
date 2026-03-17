import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";
import { groupTableColumns } from "@/components/groups/table/group-table-columns";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
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
import { paginationSchema } from "@/lib/orpc/schemas/shared";

const searchSchema = paginationSchema.extend({
	query: z.string().trim().max(100).default(""),
});

export const Route = createFileRoute("/app/groups/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, query } }) => ({
		pageIndex,
		pageSize,
		query,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, query },
	}) => {
		await queryClient.ensureQueryData(
			orpc.group.list.queryOptions({
				input: {
					filters: {
						search: query.trim() ? query.trim() : undefined,
					},
					pageIndex,
					pageSize,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { pageIndex, pageSize, query } = Route.useSearch();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const { data: groups } = useSuspenseQuery(
		orpc.group.list.queryOptions({
			input: {
				filters: {
					search: query.trim() ? query.trim() : undefined,
				},
				pageIndex,
				pageSize,
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
						<PlusIcon />
						Create Group
					</Button>
				</PageAction>
			</PageHeader>

			<PageContent className="space-y-4">
				<div className="relative max-w-sm">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) =>
							void navigate({
								to: ".",
								search: (prev) => ({
									...prev,
									pageIndex: 0,
									query: event.target.value,
								}),
								replace: true,
							})
						}
						placeholder="Search groups"
						className="pl-9"
					/>
				</div>

				<DataTable
					data={groups.data}
					columns={groupTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: groups.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
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
