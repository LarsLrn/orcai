import {
	OptionPicker,
	type PickerOption,
} from "@/components/ui/composed/option-picker";
import { m } from "@/paraglide/messages";

type DataTableSelectFilterProps<TValue extends string> = {
	label: string;
	value?: TValue;
	options: PickerOption<TValue>[];
	onChange: (value: TValue | undefined) => void;
};

const ALL_VALUE = "__all__";

const DataTableSelectFilter = <TValue extends string>({
	label,
	value,
	options,
	onChange,
}: DataTableSelectFilterProps<TValue>) => (
	<OptionPicker<TValue | typeof ALL_VALUE>
		options={[
			{
				value: ALL_VALUE,
				label: m.data_table_select_filter_all_option({
					label,
				}),
			},
			...options,
		]}
		value={value ?? ALL_VALUE}
		onChange={(nextValue) =>
			onChange(nextValue === ALL_VALUE ? undefined : (nextValue as TValue))
		}
		aria-label={label}
		className="max-w-full sm:max-w-64"
		size="sm"
	/>
);

export { DataTableSelectFilter };
