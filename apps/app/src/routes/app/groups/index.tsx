import { listGroupsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon, UserCogIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";
import { GroupTableActions } from "@/components/groups/table/group-table-actions";
import { groupTableColumns } from "@/components/groups/table/group-table-columns";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
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
import { useCreateGroupMutation } from "@/hooks/mutations/use-group-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listGroupsInputSchema.extend({
	query: z.string().trim().max(100).default(""),
});

export const Route = createFileRoute("/app/groups/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, query, sort } }) => ({
		pageIndex,
		pageSize,
		query,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, query, sort },
	}) => {
		await queryClient.query(
			orpc.group.list.queryOptions({
				input: {
					filters: {
						search: query.trim() ? query.trim() : undefined,
					},
					pageIndex,
					pageSize,
					sort,
				},
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { pageIndex, pageSize, query, sort } = Route.useSearch();
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
				sort,
			},
		}),
	);

	const createGroup = useCreateGroupMutation({
		onSuccess: () => {
			setIsCreateOpen(false);
			setName("");
			setDescription("");
		},
	});

	const onCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) {
			return;
		}

		await createGroup.mutateAsync({
			name: name.trim(),
			description: description.trim() ? description.trim() : null,
		});
	};

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.groups_page_title()}</PageTitle>
				<PageAction>
					<Button onClick={() => setIsCreateOpen(true)}>
						<PlusIcon />
						{m.groups_list_create_action()}
					</Button>
				</PageAction>
			</PageHeader>

			<PageContent>
				<DataTable
					data={groups.data}
					columns={groupTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: groups.rowCount,
						uidAccessor: "id",
						enableRowSelection: (row) => row.original.kind === "custom",
					}}
				>
					<DataTableToolbar>
						<DataTableSearch
							value={query}
							placeholder={m.groups_list_search_placeholder()}
							onChange={(value) =>
								void navigate({
									to: ".",
									search: (prev) => ({
										...prev,
										pageIndex: 0,
										query: value,
									}),
									replace: true,
								})
							}
						/>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<GroupTableActions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: UserCogIcon,
							title: m.groups_list_empty_title(),
							description: m.groups_list_empty_description(),
							actions: [
								{
									key: "create",
									label: m.groups_list_create_action(),
									icon: PlusIcon,
									variant: "default",
									onClick: () => setIsCreateOpen(true),
								},
							],
						}}
						filters={{
							query,
						}}
					/>
					<DataTablePagination />
				</DataTable>
			</PageContent>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{m.groups_create_dialog_title()}</DialogTitle>
						<DialogDescription>
							{m.groups_create_dialog_description()}
						</DialogDescription>
					</DialogHeader>

					<form className="space-y-4" onSubmit={onCreateSubmit}>
						<div className="space-y-2">
							<Label htmlFor="group-name">{m.common_name_label()}</Label>
							<Input
								id="group-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={120}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="group-description">
								{m.common_description_label()}
							</Label>
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
								{m.common_cancel_button()}
							</Button>
							<Button
								type="submit"
								loading={createGroup.isPending}
								disabled={!name.trim()}
							>
								{m.common_create_button()}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Page>
	);
}
