import type { OrganizationId, UserId } from "@orcai/core";
import type { ContentReceiver, ResourceIdentity } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { UserIcon } from "lucide-react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { SearchablePicker } from "@/components/ui/composed/searchable-picker";
import { UserAvatar } from "@/components/users/user-avatar";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Where the members who may receive content come from, each behind its own permission. */
export type ReceiverSource =
	| {
			kind: "active-organization";
	  }
	| {
			kind: "instance";
			organizationId: OrganizationId;
	  }
	| {
			kind: "item";
			resource: ResourceIdentity;
	  };

const receiversQuery = (
	source: ReceiverSource,
	search: string | undefined,
	excluded: readonly UserId[],
) => {
	switch (source.kind) {
		case "active-organization":
			return orpc.organizationMember.receivers.queryOptions({
				input: {
					search,
					excluded: [
						...excluded,
					],
				},
			});
		case "instance":
			return orpc.instance.receivers.queryOptions({
				input: {
					organizationId: source.organizationId,
					search,
					excluded: [
						...excluded,
					],
				},
			});
		case "item":
			return orpc.resource.receivers.queryOptions({
				input: {
					...source.resource,
					search,
				},
			});
	}
};

/**
 * Picks the member who receives content. Shows the chosen one with a Change
 * button, and the search list while none is chosen.
 */
export const ReceiverPicker = ({
	source,
	value,
	onChange,
	excluded = [],
	disabled,
}: {
	source: ReceiverSource;
	value: ContentReceiver | null;
	onChange: (receiver: ContentReceiver | null) => void;
	/** Members who cannot receive in this change, such as the ones leaving. */
	excluded?: readonly UserId[];
	disabled?: boolean;
}) => {
	const [query, setQuery] = useState("");
	const [debouncedQuery] = useDebounceValue(query, 300);
	const receivers = useQuery({
		...receiversQuery(source, debouncedQuery.trim() || undefined, excluded),
		enabled: value === null,
	});

	if (value) {
		return (
			<div className="flex items-center gap-2 rounded-xl border p-2">
				<UserAvatar user={value} />
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{value.name}</p>
					<p className="truncate text-muted-foreground text-xs">
						{value.email}
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					onClick={() => onChange(null)}
				>
					{m.ownership_receiver_change_button()}
				</Button>
			</div>
		);
	}

	return (
		<SearchablePicker
			query={query}
			onQueryChange={setQuery}
			placeholder={m.ownership_receiver_search_placeholder()}
			items={receivers.data?.data ?? []}
			isLoading={receivers.isLoading}
			selected={[]}
			getKey={(receiver) => receiver.id}
			onToggle={onChange}
			onClearSelection={() => onChange(null)}
			renderItem={(receiver) => ({
				option: {
					value: receiver.id,
					label: receiver.name,
					description: receiver.email,
				},
				Icon: UserIcon,
				leading: <UserAvatar user={receiver} />,
			})}
			emptyText={
				receivers.isError
					? describeError(receivers.error)
					: m.ownership_receiver_empty()
			}
			disabled={disabled}
		/>
	);
};
