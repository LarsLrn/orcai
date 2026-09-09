import type { GroupMemberRow } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { MemberRow } from "@/components/groups/member-row";
import { FilterableList } from "@/components/ui/composed/filterable-list";

const MemberList = ({
	members,
	search,
	onSearchChange,
	canRemove,
	disabled,
	onRemove,
}: {
	members: GroupMemberRow[];
	search: string;
	onSearchChange: (value: string) => void;
	canRemove?: boolean;
	disabled?: boolean;
	onRemove: (member: GroupMemberRow) => void;
}) => (
	<FilterableList
		title="Current members"
		icon={UsersIcon}
		search={search}
		onSearchChange={onSearchChange}
		placeholder="Filter members"
		isEmpty={members.length === 0}
		emptyText="No members found."
	>
		{members.map((member) => (
			<MemberRow
				key={`${member.user.id}:${member.source}`}
				member={member}
				canRemove={canRemove}
				disabled={disabled}
				onRemove={() => onRemove(member)}
			/>
		))}
	</FilterableList>
);

export { MemberList };
