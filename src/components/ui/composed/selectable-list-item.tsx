import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SelectOption<T extends string> = {
	value: T;
	label: string;
	description?: string;
	badge?: string;
};

const SelectableListItem = <T extends string>({
	option,
	onSelect,
	Icon,
	isSelected = false,
	isLoading = false,
	className,
}: {
	option: SelectOption<T>;
	onSelect: (value: T[]) => void;
	Icon?: LucideIcon;
	isSelected?: boolean;
	isLoading?: boolean;
	className?: string;
}) => {
	return (
		<Button
			variant="ghost"
			nativeButton={false}
			className={cn(
				"flex h-auto w-full items-center justify-between border-muted px-2 py-1 text-left text-sm hover:bg-muted/50",
				isSelected && "bg-muted",
				className,
			)}
			onClick={() =>
				onSelect([
					option.value,
				])
			}
			disabled={isLoading}
		>
			<div className="flex min-w-0 items-center gap-3">
				{Icon && (
					<div className="flex size-8 items-center justify-center rounded-full text-muted-foreground">
						<Icon className="h-4 w-4" />
					</div>
				)}
				<div className={cn("min-w-0", !Icon && "pl-3")}>
					<div className="flex items-center gap-2">
						<p className="truncate font-medium text-sm">{option.label}</p>
						{option.badge && (
							<Badge variant="outline" className="text-sm">
								{option.badge}
							</Badge>
						)}
					</div>
					<p className="truncate text-muted-foreground text-xs">
						{option.description}
					</p>
				</div>
			</div>
			{isLoading ? (
				<Spinner />
			) : (
				<Checkbox checked={isSelected} className="bg-card" />
			)}
		</Button>
	);
};

export { SelectableListItem };
