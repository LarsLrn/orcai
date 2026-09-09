import type { GroupId } from "@orcai/core";
import { getInitial } from "@orcai/core";
import type { GroupMemberUser } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { UserIcon } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SearchablePickerRow } from "@/components/ui/composed/searchable-picker";
import { SearchablePicker } from "@/components/ui/composed/searchable-picker";
import { orpc } from "@/lib/orpc/orpc";

const renderCandidate = (user: GroupMemberUser): SearchablePickerRow => ({
	option: {
		value: user.id,
		label: user.name,
		description: user.email,
	},
	Icon: UserIcon,
	leading: (
		<Avatar className="size-8">
			<AvatarImage src={user.image ?? undefined} alt={user.name} />
			<AvatarFallback>{getInitial(user.name)}</AvatarFallback>
		</Avatar>
	),
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
			placeholder="Search users"
			items={candidates.data?.data ?? []}
			isLoading={candidates.isLoading}
			selected={selectedUsers}
			getKey={(user) => user.id}
			onToggle={onToggle}
			onClearSelection={onClearSelection}
			renderItem={renderCandidate}
			emptyText={
				debouncedQuery.trim()
					? "No members match this search."
					: "Everyone is already in this group."
			}
			disabled={disabled}
		/>
	);
};

export { MemberPicker };
