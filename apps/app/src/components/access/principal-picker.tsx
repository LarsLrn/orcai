import { getInitial } from "@orcai/core";
import type {
	PrincipalType,
	ResourcePrincipal,
	ResourceRef,
} from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { UserIcon, UsersIcon } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SearchablePickerRow } from "@/components/ui/composed/searchable-picker";
import { SearchablePicker } from "@/components/ui/composed/searchable-picker";
import { useShareablePrincipals } from "@/hooks/authz/use-resource-access";

type PrincipalPickerProps = {
	resourceRef: ResourceRef;
	principalType: PrincipalType;
	query: string;
	onQueryChange: (value: string) => void;
	selectedPrincipals: ResourcePrincipal[];
	onToggle: (principal: ResourcePrincipal) => void;
	onClearSelection: () => void;
	disabled?: boolean;
};

const renderPrincipal = (principal: ResourcePrincipal): SearchablePickerRow => {
	const isUser = principal.type === "user";
	const subtitle = isUser
		? principal.email
		: principal.description ||
			(principal.kind === "system" &&
			principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
				? "System group"
				: "Custom group");

	return {
		option: {
			value: principal.id,
			label: principal.name,
			description: subtitle,
			badge: !isUser && principal.kind === "system" ? "System" : undefined,
		},
		Icon: isUser ? UserIcon : UsersIcon,
		leading: isUser ? (
			<Avatar className="size-8">
				<AvatarImage src={principal.image ?? undefined} alt={principal.name} />
				<AvatarFallback>{getInitial(principal.name)}</AvatarFallback>
			</Avatar>
		) : undefined,
	};
};

const PrincipalPicker = ({
	resourceRef,
	principalType,
	query,
	onQueryChange,
	selectedPrincipals,
	onToggle,
	onClearSelection,
	disabled,
}: PrincipalPickerProps) => {
	const [debouncedQuery] = useDebounceValue(query, 300);
	const principals = useShareablePrincipals(resourceRef, debouncedQuery, {
		limit: 30,
		principalType,
	});

	return (
		<SearchablePicker
			query={query}
			onQueryChange={onQueryChange}
			placeholder={
				principalType === "user" ? "Search members" : "Search groups"
			}
			items={principals.data?.data ?? []}
			isLoading={principals.isLoading}
			selected={selectedPrincipals}
			getKey={(principal) => principal.id}
			onToggle={onToggle}
			onClearSelection={onClearSelection}
			renderItem={renderPrincipal}
			emptyText="No people or groups match this search."
			disabled={disabled}
		/>
	);
};

export { PrincipalPicker };
