import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "@/components/ui/item";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type PickerOption<T extends string> = {
	value: T;
	label: string;
	description?: string;
	disabled?: boolean;
};

const OptionPicker = <T extends string>({
	options,
	onChange,
	value,
	placeholder,
	disabled,
	size = "default",
	side,
	className,
	id,
	name,
	"aria-label": ariaLabel,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
}: {
	options: readonly PickerOption<T>[];
	onChange: (value: T) => void;
	value: T | null;
	placeholder?: string;
	disabled?: boolean;
	size?: "sm" | "default";
	side?: "top" | "bottom";
	className?: string;
	id?: string;
	name?: string;
	"aria-label"?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
}) => (
	<Select
		name={name}
		// Unknown values, e.g. while options load, show the placeholder.
		value={options.some((option) => option.value === value) ? value : null}
		onValueChange={(nextValue) => {
			if (nextValue !== null) onChange(nextValue);
		}}
		items={options}
		disabled={disabled}
	>
		<SelectTrigger
			id={id}
			aria-label={ariaLabel}
			aria-invalid={ariaInvalid}
			aria-describedby={ariaDescribedBy}
			className={className}
			size={size}
		>
			<SelectValue placeholder={placeholder} />
		</SelectTrigger>
		<SelectContent
			side={side}
			align="start"
			className="w-auto min-w-[max(--spacing(36),var(--anchor-width))]"
		>
			{options.map((option) => (
				<SelectItem
					key={option.value}
					value={option.value}
					disabled={option.disabled}
				>
					{option.description ? (
						<Item size="xs" className="w-full p-0">
							<ItemContent className="gap-0">
								<ItemTitle>{option.label}</ItemTitle>
								<ItemDescription className="text-wrap text-xs">
									{option.description}
								</ItemDescription>
							</ItemContent>
						</Item>
					) : (
						option.label
					)}
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);

export type { PickerOption };
export { OptionPicker };
