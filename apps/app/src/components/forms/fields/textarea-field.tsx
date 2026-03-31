import { useStore } from "@tanstack/react-form";
import { useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useFieldContext } from "@/hooks/form/context";
import { cn } from "@/lib/utils";

const TextareaField = ({
	label,
	description,
	unit,
	...props
}: {
	label: string;
	description?: string;
	unit?: string;
} & React.ComponentProps<"textarea">) => {
	const field = useFieldContext<string>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel className="font-bold" htmlFor={id}>
				{label}
			</FieldLabel>
			<Textarea
				id={id}
				name={field.name}
				value={field.state.value}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				aria-invalid={isInvalid}
				className={cn("min-h-30", props.className)}
				{...props}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default TextareaField;
