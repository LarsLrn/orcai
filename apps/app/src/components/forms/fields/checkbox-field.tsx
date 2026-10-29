import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useFormField } from "./form-field";

const CheckboxField = ({ label }: { label: string }) => {
	const { field, ...state } = useFormField<boolean>(label);

	return (
		<Field orientation="horizontal" data-invalid={state.isInvalid}>
			<Checkbox
				{...state.control}
				name={field.name}
				checked={field.state.value}
				onCheckedChange={field.handleChange}
			/>
			<FieldLabel htmlFor={state.control.id} className="font-normal">
				{label}
			</FieldLabel>
			{state.isInvalid && (
				<FieldError id={state.errorId} errors={state.errors} />
			)}
		</Field>
	);
};

export default CheckboxField;
