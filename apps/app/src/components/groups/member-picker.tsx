import type { GroupId } from "@orcai/core";
import type { GroupMemberUser } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { UserIcon } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import type { SearchablePickerRow } from "@/components/ui/composed/searchable-picker";
import { SearchablePicker } from "@/components/ui/composed/searchable-picker";
import { UserAvatar } from "@/components/users/user-avatar";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const renderCandidate = (user: GroupMemberUser): SearchablePickerRow => ({
	option: {
		value: user.id,
		label: user.name,
		description: user.email,
	},
	Icon: UserIcon,
	leading: <UserAvatar user={user} />,
});

const MemberPicker = ({
	groupId,
	query,
	onQueryChange,
	selectedUsers,
	onToggle,
	onClearSelection,
	disabled,
}: {
	groupId: GroupId;
	query: string;
	onQueryChange: (value: string) => void;
	selectedUsers: GroupMemberUser[];
	onToggle: (user: GroupMemberUser) => void;
	onClearSelection: () => void;
	disabled?: boolean;
}) => {
	const [debouncedQuery] = useDebounceValue(query, 300);
	const candidates = useQuery(
		orpc.group.listCandidates.queryOptions({
			input: {
				groupId,
				query: debouncedQuery.trim() || undefined,
			},
		}),
	);

	return (
		<SearchablePicker
			query={query}
			onQueryChange={onQueryChange}
			placeholder={m.groups_member_picker_search_placeholder()}
			items={candidates.data?.data ?? []}
			isLoading={candidates.isLoading}
			selected={selectedUsers}
			getKey={(user) => user.id}
			onToggle={onToggle}
			onClearSelection={onClearSelection}
			renderItem={renderCandidate}
			emptyText={
				debouncedQuery.trim()
					? m.groups_member_picker_empty_state_no_match()
					: m.groups_member_picker_empty_state_all_members()
			}
			disabled={disabled}
		/>
	);
};

export { MemberPicker };
