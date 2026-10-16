import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";
import { m } from "@/paraglide/messages";

const SelectField = ({
	label,
	options,
	description,
	placeholder = m.forms_select_field_placeholder(),
	disabled = false,
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
}) => {
	const field = useFieldContext<string>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field orientation="responsive" data-invalid={isInvalid}>
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				{description && <FieldDescription>{description}</FieldDescription>}
				{isInvalid && <FieldError errors={errors} />}
			</FieldContent>
			<OptionPicker
				id={id}
				name={field.name}
				options={options ?? []}
				value={field.state.value}
				onChange={field.handleChange}
				placeholder={placeholder}
				disabled={disabled || options === undefined || options.length === 0}
				aria-invalid={isInvalid}
				className="min-w-30"
			/>
		</Field>
	);
};

export default SelectField;
