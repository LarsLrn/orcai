import type { GroupMemberRow } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { MemberRow } from "@/components/groups/member-row";
import { FilterableList } from "@/components/ui/composed/filterable-list";
import { m } from "@/paraglide/messages";

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
		title={m.groups_member_list_title()}
		icon={UsersIcon}
		search={search}
		onSearchChange={onSearchChange}
		placeholder={m.groups_member_list_filter_placeholder()}
		isEmpty={members.length === 0}
		emptyText={m.groups_member_list_empty_state_description()}
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
