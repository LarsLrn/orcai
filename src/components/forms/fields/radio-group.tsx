import { RadioGroup } from "@radix-ui/react-dropdown-menu";
import { useStore } from "@tanstack/react-form";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";

const CheckboxGroup = ({
	label,
	options,
	description,
}: {
	label: string;
	options: { value: string; label: string; description?: string }[] | undefined;
	description?: string;
	placeholder?: string;
}) => {
	const field = useFieldContext<string>();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<FieldSet>
			<FieldLegend variant="label">{label}</FieldLegend>
			{description && <FieldDescription>{description}</FieldDescription>}
			<RadioGroup value={field.state.value} onValueChange={field.handleChange}>
				{options?.map((item) => (
					<FieldLabel
						key={item.value}
						htmlFor={`form-radiogroup-${item.value}`}
					>
						<Field orientation="horizontal" data-invalid={isInvalid}>
							<FieldContent>
								<FieldTitle>{item.label}</FieldTitle>
								{item.description && (
									<FieldDescription>{item.description}</FieldDescription>
								)}
							</FieldContent>
							<RadioGroup
								value={item.value}
								id={`form-radiogroup-${item.value}`}
								aria-invalid={isInvalid}
							/>
						</Field>
					</FieldLabel>
				))}
			</RadioGroup>
			{isInvalid && <FieldError errors={errors} />}
		</FieldSet>
	);
};

export default CheckboxGroup;
