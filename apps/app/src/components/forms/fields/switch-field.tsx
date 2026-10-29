import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useFormField } from "./form-field";

/** A plain row: label and hint on the left, the switch on the right. */
const SwitchField = ({
	label,
	description,
}: {
	label: string;
	description?: string;
}) => {
	const { field, ...state } = useFormField<boolean>(label, description);

	return (
		<Field
			orientation="horizontal"
			data-invalid={state.isInvalid}
			className="justify-between gap-6"
		>
			<FieldContent>
				<FieldLabel id={state.labelId} htmlFor={state.control.id}>
					{label}
				</FieldLabel>
				{description && (
					<FieldDescription id={state.hintId}>{description}</FieldDescription>
				)}
				{state.isInvalid && (
					<FieldError id={state.errorId} errors={state.errors} />
				)}
			</FieldContent>
			<Switch
				{...state.control}
				aria-labelledby={state.labelId}
				name={field.name}
				checked={field.state.value}
				onCheckedChange={field.handleChange}
			/>
		</Field>
	);
};

export default SwitchField;
