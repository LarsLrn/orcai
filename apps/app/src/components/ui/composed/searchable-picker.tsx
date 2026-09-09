import type { LucideIcon } from "lucide-react";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { SelectOption } from "@/components/ui/composed/selectable-list-item";
import { SelectableListItem } from "@/components/ui/composed/selectable-list-item";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type SearchablePickerRow = {
	option: SelectOption<string>;
	Icon?: LucideIcon;
	leading?: ReactNode;
};

type SearchablePickerProps<TItem> = {
	query: string;
	onQueryChange: (value: string) => void;
	placeholder: string;
	items: TItem[];
	isLoading: boolean;
	selected: TItem[];
	getKey: (item: TItem) => string;
	onToggle: (item: TItem) => void;
	onClearSelection: () => void;
	renderItem: (item: TItem) => SearchablePickerRow;
	emptyText: string;
	disabled?: boolean;
};

const SearchablePicker = <TItem,>({
	query,
	onQueryChange,
	placeholder,
	items,
	isLoading,
	selected,
	getKey,
	onToggle,
	onClearSelection,
	renderItem,
	emptyText,
	disabled,
}: SearchablePickerProps<TItem>) => {
	const selectedKeys = new Set(selected.map(getKey));

	return (
		<div className="space-y-2">
			<div className="relative">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder={placeholder}
					className="pl-9"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					disabled={disabled}
				/>
			</div>
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-xs">
					{selected.length} selected
				</p>
				<Button
					variant="destructive"
					size="xs"
					className="text-xs"
					onClick={onClearSelection}
					disabled={disabled || selected.length === 0}
				>
					Clear selection
				</Button>
			</div>

			<ScrollArea className="h-48 rounded-xl border">
				<div className="flex flex-col gap-1 p-1">
					{items.map((item) => {
						const key = getKey(item);
						const row = renderItem(item);

						return (
							<SelectableListItem
								key={key}
								option={row.option}
								onSelect={(values) => {
									if (values.includes(row.option.value)) {
										onToggle(item);
									}
								}}
								Icon={row.Icon}
								leading={row.leading}
								isSelected={selectedKeys.has(key)}
								isLoading={isLoading}
							/>
						);
					})}

					{!isLoading && items.length === 0 && (
						<div className="p-4 text-center text-muted-foreground text-sm">
							{emptyText}
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};

export type { SearchablePickerRow };
export { SearchablePicker };
