import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";

const CheckboxField = ({ label }: { label: string }) => {
	const field = useFieldContext<boolean>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field orientation="horizontal" data-invalid={isInvalid}>
			<Checkbox
				id={id}
				name={field.name}
				checked={field.state.value}
				onCheckedChange={field.handleChange}
				aria-invalid={isInvalid}
			/>
			<FieldLabel htmlFor={id} className="font-normal">
				{label}
			</FieldLabel>
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default CheckboxField;
