import { SearchIcon, UserIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectableListItem } from "@/components/ui/composed/selectable-list-item";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShareablePrincipals } from "@/hooks/authz/use-resource-access";
import type {
	PrincipalType,
	ResourcePrincipal,
	ResourceRef,
} from "@/lib/orpc/schemas/resource";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@/lib/orpc/schemas/resource";

type PrincipalPickerProps = {
	resourceRef: ResourceRef;
	principalType: PrincipalType;
	query: string;
	onQueryChange: (value: string) => void;
	selectedPrincipalIds: string[];
	onToggle: (principal: ResourcePrincipal) => void;
	onClearSelection: () => void;
	excludedPrincipalIds?: string[];
	disabled?: boolean;
};

const PrincipalPicker = ({
	resourceRef,
	principalType,
	query,
	onQueryChange,
	selectedPrincipalIds,
	onToggle,
	onClearSelection,
	excludedPrincipalIds = [],
	disabled,
}: PrincipalPickerProps) => {
	const principals = useShareablePrincipals(resourceRef, query, {
		enabled: !disabled,
		limit: 30,
		principalType,
	});

	const visiblePrincipals =
		principals.data?.data.filter(
			(principal) => !excludedPrincipalIds.includes(principal.id),
		) ?? [];

	const searchPlaceholder =
		principalType === "user"
			? "Search organisation members..."
			: "Search organisation groups...";

	return (
		<div className="space-y-2">
			<div className="relative">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder={searchPlaceholder}
					className="pl-9"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					disabled={disabled}
				/>
			</div>
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-xs">
					Selected {selectedPrincipalIds.length}
				</p>
				<Button
					variant="destructive"
					size="xs"
					className="text-xs"
					onClick={onClearSelection}
					disabled={disabled || selectedPrincipalIds.length === 0}
				>
					Clear selection
				</Button>
			</div>

			<ScrollArea className="h-48 rounded-lg border">
				<div className="flex flex-col gap-1 p-1">
					{visiblePrincipals.map((principal) => {
						const isSelected = selectedPrincipalIds.includes(principal.id);
						const isUser = principal.type === "user";
						const subtitle = isUser
							? principal.email
							: principal.description ||
								(principal.kind === "system" &&
								principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
									? "System group"
									: "Custom group");

						return (
							<SelectableListItem
								key={principal.id}
								option={{
									value: principal.id,
									label: principal.name,
									description: subtitle,
									badge:
										!isUser && principal.kind === "system"
											? "System"
											: undefined,
								}}
								onSelect={(values) => {
									if (values.includes(principal.id)) {
										onToggle(principal);
									}
								}}
								Icon={isUser ? UserIcon : UsersIcon}
								isSelected={isSelected}
								isLoading={principals.isLoading}
							/>
						);
					})}

					{!principals.isLoading && visiblePrincipals.length === 0 && (
						<div className="p-4 text-center text-muted-foreground text-sm">
							No matching principals found.
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};

export { PrincipalPicker };
