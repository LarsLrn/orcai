import { useStore } from "@tanstack/react-form";
import { useId } from "react";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useFieldContext } from "@/hooks/form/context";

const SwitchField = ({
	label,
	description,
}: {
	label: string;
	description?: string;
}) => {
	const field = useFieldContext<boolean>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<FieldLabel htmlFor={id}>
			<Field orientation="horizontal" data-invalid={isInvalid}>
				<FieldContent>
					<FieldTitle className="font-bold">{label}</FieldTitle>
					{description && <FieldDescription>{description}</FieldDescription>}
					{isInvalid && <FieldError errors={errors} />}
				</FieldContent>
				<Switch
					id={id}
					name={field.name}
					checked={field.state.value}
					onCheckedChange={field.handleChange}
					aria-invalid={isInvalid}
				/>
			</Field>
		</FieldLabel>
	);
};

export default SwitchField;
