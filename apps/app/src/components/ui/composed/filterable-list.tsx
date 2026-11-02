import type { LucideIcon } from "lucide-react";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import { Input } from "@/components/ui/input";

type FilterableListProps = {
	title: string;
	icon: LucideIcon;
	search: string;
	onSearchChange: (value: string) => void;
	placeholder: string;
	isEmpty: boolean;
	emptyText: string;
	disabled?: boolean;
	/** List items, one `li` per entry. */
	children: ReactNode;
};

const FilterableList = ({
	title,
	icon: Icon,
	search,
	onSearchChange,
	placeholder,
	isEmpty,
	emptyText,
	disabled,
	children,
}: FilterableListProps) => {
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className="space-y-3">
			<div className="flex items-center gap-2">
				<Icon className="text-muted-foreground h-4 w-4" />
				<p id={titleId} className="text-sm font-medium">
					{title}
				</p>
			</div>
			<div className="relative max-w-sm">
				<SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input
					className="pl-9"
					aria-label={placeholder}
					placeholder={placeholder}
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					disabled={disabled}
				/>
			</div>
			<div className="max-h-64 overflow-auto">
				{isEmpty ? (
					<div className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
						{emptyText}
					</div>
				) : (
					<ul className="space-y-2">{children}</ul>
				)}
			</div>
		</section>
	);
};

export { FilterableList };
