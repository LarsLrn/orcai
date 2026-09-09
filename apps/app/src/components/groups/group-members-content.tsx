import type { Group, GroupMemberUser } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { MemberList } from "@/components/groups/member-list";
import { MemberPicker } from "@/components/groups/member-picker";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useAddGroupMembersMutation,
	useRemoveGroupMembersMutation,
} from "@/hooks/mutations/use-group-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { toggleSelection } from "@/lib/utils/array-utils";

const GroupMembersContent = ({ group }: { group: Group }) => {
	const groupId = group.id;
	const [memberSearch, setMemberSearch] = useState("");
	const [candidateSearch, setCandidateSearch] = useState("");
	const [selectedUsers, setSelectedUsers] = useState<GroupMemberUser[]>([]);

	const members = useQuery(
		orpc.group.listMembers.queryOptions({
			input: {
				groupId,
				pageIndex: 0,
				pageSize: 200,
				query: memberSearch.trim() || undefined,
			},
		}),
	);
	const addMembers = useAddGroupMembersMutation(groupId);
	const removeMembers = useRemoveGroupMembersMutation(groupId);

	const isSystemGroup = group.kind === "system";
	const isMutating = addMembers.isPending || removeMembers.isPending;

	const handleAdd = async () => {
		const result = await addMembers.mutateAsync({
			groupId,
			userIds: selectedUsers.map((user) => user.id),
		});

		if (result.status === "success") {
			setSelectedUsers([]);
		}
	};

	return (
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
					<div className="space-y-3 rounded-2xl border p-4">
						<div className="flex items-center gap-2">
							<UsersIcon className="h-4 w-4 text-muted-foreground" />
							<p className="font-medium text-sm">Add members</p>
						</div>
						<MemberPicker
							groupId={groupId}
							query={candidateSearch}
							onQueryChange={setCandidateSearch}
							selectedUsers={selectedUsers}
							onToggle={(user) =>
								setSelectedUsers((current) =>
									toggleSelection(current, user, (item) => item.id),
								)
							}
							onClearSelection={() => setSelectedUsers([])}
							disabled={isMutating}
						/>
						<Button
							disabled={selectedUsers.length === 0 || isMutating}
							onClick={handleAdd}
						>
							<PlusIcon />
							Add Selected
						</Button>
					</div>
				)}

				<MemberList
					members={members.data?.data ?? []}
					search={memberSearch}
					onSearchChange={setMemberSearch}
					canRemove={!isSystemGroup}
					disabled={isMutating}
					onRemove={(member) =>
						removeMembers.mutate({
							groupId,
							userIds: [
								member.user.id,
							],
						})
					}
				/>
			</CardContent>
		</Card>
	);
};

export { GroupMembersContent };
