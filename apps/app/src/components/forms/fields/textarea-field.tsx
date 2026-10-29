import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormField, useFormField } from "./form-field";

const TextareaField = ({
	label,
	description,
	className,
	...props
}: {
	label: string;
	description?: string;
} & React.ComponentProps<"textarea">) => {
	const { field, ...state } = useFormField<string>(label, description);

	return (
		<FormField state={state} label={label} description={description}>
			<Textarea
				{...props}
				{...state.control}
				name={field.name}
				value={field.state.value}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				className={cn("min-h-30", className)}
			/>
		</FormField>
	);
};

export default TextareaField;
