import { useSelector } from "@tanstack/react-store";
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
import { useFieldLabel } from "@/hooks/form/field-labels";
import { m } from "@/paraglide/messages";

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
	useFieldLabel(field, label);
	const labelId = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field orientation="responsive" data-invalid={isInvalid}>
			<FieldContent>
				<FieldLabel id={labelId}>{label}</FieldLabel>
				{description && <FieldDescription>{description}</FieldDescription>}
				{isInvalid && <FieldError errors={errors} />}
			</FieldContent>
			<MultiSelect
				aria-labelledby={labelId}
				aria-invalid={isInvalid}
				options={options}
				defaultValue={field.state.value}
				onValueChange={field.handleChange}
				placeholder={placeholder ?? m.forms_multi_select_field_placeholder()}
				disabled={disabled || options === undefined || options.length === 0}
			/>
		</Field>
	);
};

export default MultiSelectField;
