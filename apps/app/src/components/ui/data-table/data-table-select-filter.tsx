import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type DataTableSelectFilterOption<TValue extends string> = {
	label: string;
	value: TValue;
};

type DataTableSelectFilterProps<TValue extends string> = {
	label: string;
	value?: TValue;
	options: DataTableSelectFilterOption<TValue>[];
	onChange: (value: TValue | undefined) => void;
	allLabel?: string;
};

const ALL_VALUE = "__all__";

const DataTableSelectFilter = <TValue extends string>({
	label,
	value,
	options,
	onChange,
	allLabel = "All",
}: DataTableSelectFilterProps<TValue>) => (
	<Select
		value={value ?? ALL_VALUE}
		onValueChange={(nextValue) =>
			onChange(nextValue === ALL_VALUE ? undefined : (nextValue as TValue))
		}
	>
		<SelectTrigger
			aria-label={label}
			className="max-w-full sm:max-w-64"
			size="sm"
		>
			<SelectValue>
				{value
					? options.find((option) => option.value === value)?.label
					: `${label}: ${allLabel}`}
			</SelectValue>
		</SelectTrigger>
		<SelectContent align="start">
			<SelectItem value={ALL_VALUE}>{`${label}: ${allLabel}`}</SelectItem>
			{options.map((option) => (
				<SelectItem key={option.value} value={option.value}>
					{option.label}
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);

export type { DataTableSelectFilterOption };
export { DataTableSelectFilter };
