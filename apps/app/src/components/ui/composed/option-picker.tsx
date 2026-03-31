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
import { cn } from "@/lib/utils";

type PickerOption<T extends string> = {
	value: T;
	label: string;
	description?: string;
};

const PickerOptionItem = <T extends string>({
	option,
}: {
	option: PickerOption<T>;
}) => {
	return (
		<Item size="xs" className="w-full p-0">
			<ItemContent className="gap-0">
				<ItemTitle>{option.label}</ItemTitle>
				{option.description && (
					<ItemDescription className="text-wrap text-xs">
						{option.description}
					</ItemDescription>
				)}
			</ItemContent>
		</Item>
	);
};

const OptionPicker = <T extends string>({
	options,
	onChange,
	value,
	disabled,
	size = "default",
	className,
}: {
	options: PickerOption<T>[];
	onChange: (value: T) => void;
	value: T;
	disabled?: boolean;
	size?: "sm" | "default";
	className?: string;
}) => {
	return (
		<Select
			value={value}
			onValueChange={(value) => onChange(value as T)}
			disabled={disabled}
		>
			<SelectTrigger className={cn("w-32", className)} size={size}>
				<SelectValue>
					{(value) => options.find((opt) => opt.value === value)?.label}
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="w-auto">
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						<PickerOptionItem option={option} />
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};

export type { PickerOption };
export { OptionPicker };
