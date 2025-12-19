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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useFieldContext } from "@/hooks/form/context";

const SelectField = ({
	label,
	options,
	description,
	placeholder,
	disabled,
}: {
	label: string;
	options: { value: string; label: string }[] | undefined;
	description?: string;
	placeholder?: string;
	disabled?: boolean;
}) => {
	const field = useFieldContext<string>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
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
			<Select
				name={field.name}
				value={field.state.value}
				onValueChange={field.handleChange}
				disabled={disabled || options === undefined || options.length === 0}
			>
				<SelectTrigger
					id={id}
					aria-invalid={isInvalid}
					className="min-w-[120px]"
				>
					<SelectValue placeholder={placeholder ?? "Select"} />
				</SelectTrigger>
				<SelectContent position="item-aligned">
					{options?.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
};

export default SelectField;
