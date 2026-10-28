import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type SearchFieldProps = Omit<
	React.ComponentProps<typeof Input>,
	"value" | "onChange"
> & {
	value: string;
	onValueChange: (value: string) => void;
	onClear?: () => void;
};

const SearchField = ({
	value,
	onValueChange,
	onClear = () => onValueChange(""),
	placeholder = m.common_search_placeholder(),
	className,
	...inputProps
}: SearchFieldProps) => (
	<div className={cn("relative", className)}>
		<SearchIcon
			aria-hidden="true"
			className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			{...inputProps}
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
			aria-label={placeholder}
			placeholder={placeholder}
			className="h-8 pr-9 pl-9"
		/>
		{value ? (
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-1/2 right-1 -translate-y-1/2"
				onClick={onClear}
			>
				<XIcon aria-hidden="true" />
				<span className="sr-only">{m.data_table_search_clear_label()}</span>
			</Button>
		) : null}
	</div>
);

export { SearchField };
