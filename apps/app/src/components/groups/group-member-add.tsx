import type { Group, GroupMemberUser } from "@orcai/schema";
import { PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { MemberPicker } from "@/components/groups/member-picker";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAddGroupMembersMutation } from "@/hooks/mutations/use-group-mutations";
import { toggleSelection } from "@/lib/utils/array-utils";
import { m } from "@/paraglide/messages";

/** Picks organisation members and adds them to a custom group. */
const GroupMemberAdd = ({ group }: { group: Group }) => {
	const groupId = group.id;
	const [candidateSearch, setCandidateSearch] = useState("");
	const [selectedUsers, setSelectedUsers] = useState<GroupMemberUser[]>([]);

	const addMembers = useAddGroupMembersMutation();
	const isMutating = addMembers.isPending;

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
				<CardTitle className="flex items-center gap-2">
					<UsersIcon className="size-4 text-muted-foreground" />
					{m.groups_members_add_heading()}
				</CardTitle>
				<CardDescription>
					{m.groups_members_card_description_custom()}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
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
					loading={addMembers.isPending}
					disabled={selectedUsers.length === 0 || isMutating}
					onClick={handleAdd}
				>
					<PlusIcon />
					{m.groups_members_add_selected_action()}
				</Button>
			</CardContent>
		</Card>
	);
};

export { GroupMemberAdd };
