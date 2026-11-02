import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	leading,
	isSelected = false,
	isLoading = false,
	className,
}: {
	option: SelectOption<T>;
	onSelect: (value: T[]) => void;
	Icon?: LucideIcon;
	leading?: ReactNode;
	isSelected?: boolean;
	isLoading?: boolean;
	className?: string;
}) => {
	return (
		<Button
			variant="ghost"
			aria-pressed={isSelected}
			className={cn(
				"border-muted hover:bg-muted/50 flex h-auto w-full items-center justify-between px-2 py-1 text-left text-sm",
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
				{leading ??
					(Icon && (
						<div className="text-muted-foreground flex size-8 items-center justify-center rounded-full">
							<Icon className="h-4 w-4" />
						</div>
					))}
				<div className={cn("min-w-0", !Icon && !leading && "pl-3")}>
					<div className="flex items-center gap-2">
						<p className="truncate text-sm font-medium">{option.label}</p>
						{option.badge && (
							<Badge variant="outline" className="text-sm">
								{option.badge}
							</Badge>
						)}
					</div>
					<p className="text-muted-foreground truncate text-xs">
						{option.description}
					</p>
				</div>
			</div>
			{isLoading ? (
				<Spinner />
			) : (
				<span
					aria-hidden="true"
					data-checked={isSelected || undefined}
					className="bg-card text-primary-foreground data-checked:border-primary data-checked:bg-primary flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-transparent"
				>
					{isSelected && <CheckIcon className="size-3.5" />}
				</span>
			)}
		</Button>
	);
};

export type { SelectOption };
export { SelectableListItem };
