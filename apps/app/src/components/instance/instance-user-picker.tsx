import type { InstanceUser } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { UserIcon } from "lucide-react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { SearchablePicker } from "@/components/ui/composed/searchable-picker";
import { UserAvatar } from "@/components/users/user-avatar";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Picks one account of the instance, searched by name or email. */
export const InstanceUserPicker = ({
	value,
	onChange,
	disabled,
}: {
	value: InstanceUser | null;
	onChange: (user: InstanceUser | null) => void;
	disabled?: boolean;
}) => {
	const [query, setQuery] = useState("");
	const [debouncedQuery] = useDebounceValue(query, 300);
	const users = useQuery(
		orpc.user.listAll.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 20,
				filters: {
					search: debouncedQuery.trim() || undefined,
				},
			},
		}),
	);

	return (
		<SearchablePicker
			query={query}
			onQueryChange={setQuery}
			placeholder={m.instance_user_picker_search_placeholder()}
			items={users.data?.data ?? []}
			isLoading={users.isLoading}
			selected={
				value
					? [
							value,
						]
					: []
			}
			getKey={(user) => user.id}
			onToggle={(user) => onChange(user.id === value?.id ? null : user)}
			onClearSelection={() => onChange(null)}
			renderItem={(user) => ({
				option: {
					value: user.id,
					label: user.name,
					description: user.email,
				},
				Icon: UserIcon,
				leading: <UserAvatar user={user} />,
			})}
			emptyText={m.instance_user_picker_empty()}
			disabled={disabled}
		/>
	);
};
