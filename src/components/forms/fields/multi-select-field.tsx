import { useStore } from "@tanstack/react-form";
import { useId } from "react";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import {
	MultiSelect,
	type MultiSelectOption,
} from "@/components/ui/multi-select";
import { useFieldContext } from "@/hooks/form/context";

const MultiSelectField = ({
	label,
	options,
	description,
	placeholder,
	disabled,
}: {
	label: string;
	options: MultiSelectOption[];
	description?: string;
	placeholder?: string;
	disabled?: boolean;
}) => {
	const field = useFieldContext<string[]>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	console.log(
		"State value:",
		field.state.value.filter((val) => options.some((opt) => opt.value === val)),
	);

	return (
		<Field orientation="responsive" data-invalid={isInvalid}>
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				{description && <FieldDescription>{description}</FieldDescription>}
				{isInvalid && <FieldError errors={errors} />}
			</FieldContent>
			<MultiSelect
				id={id}
				aria-invalid={isInvalid}
				options={options}
				defaultValue={field.state.value}
				value={field.state.value}
				onValueChange={field.handleChange}
				placeholder={placeholder ?? "Select multiple"}
				disabled={disabled || options === undefined || options.length === 0}
			/>
		</Field>
	);
};

export default MultiSelectField;
