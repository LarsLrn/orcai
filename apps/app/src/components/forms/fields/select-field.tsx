import { OptionPicker } from "@/components/ui/composed/option-picker";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
	type ControlWidth,
	FormField,
	formTriggerText,
	useFormField,
} from "./form-field";

const SelectField = ({
	label,
	options,
	description,
	placeholder = m.forms_select_field_placeholder(),
	disabled = false,
	width = "short",
}: {
	label: string;
	options:
		| {
				value: string;
				label: string;
		  }[]
		| undefined;
	description?: string;
	placeholder?: string;
	disabled?: boolean;
	width?: ControlWidth;
}) => {
	const { field, ...state } = useFormField<string>(label, description);

	return (
		<FormField
			state={state}
			label={label}
			description={description}
			width={width}
		>
			<OptionPicker
				{...state.control}
				name={field.name}
				options={options ?? []}
				value={field.state.value}
				onChange={field.handleChange}
				placeholder={placeholder}
				disabled={disabled || options === undefined || options.length === 0}
				className={cn("w-full", formTriggerText)}
			/>
		</FormField>
	);
};

export default SelectField;
