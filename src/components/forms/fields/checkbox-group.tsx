import { useStore } from "@tanstack/react-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";

const CheckboxGroup = ({
	label,
	options,
	description,
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
}) => {
	const field = useFieldContext<string[]>();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<FieldSet>
			<FieldLegend variant="label">{label}</FieldLegend>
			{description && <FieldDescription>{description}</FieldDescription>}
			<FieldGroup data-slot="checkbox-group">
				{options?.map((item) => (
					<Field
						orientation="horizontal"
						data-invalid={isInvalid}
						key={item.value}
					>
						<Checkbox
							id={`form-checkbox-${item.value}`}
							name={field.name}
							aria-invalid={isInvalid}
							checked={field.state.value.includes(item.value)}
							onCheckedChange={(checked) => {
								if (checked) {
									field.pushValue(item.value);
								} else {
									const index = field.state.value.indexOf(item.value);
									if (index > -1) {
										field.removeValue(index);
									}
								}
							}}
						/>
						<FieldLabel
							htmlFor={`form-checkbox-${item.value}`}
							className="font-normal"
						>
							{item.label}
						</FieldLabel>
					</Field>
				))}
			</FieldGroup>
			{isInvalid && <FieldError errors={errors} />}
		</FieldSet>
	);
};

export default CheckboxGroup;
