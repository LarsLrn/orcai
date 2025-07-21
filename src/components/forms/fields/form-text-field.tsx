import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FormTextFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** The label text for the form field */
	label?: string;
	/** The description text for the form field */
	description?: string;
	/** The number of rows for the textarea */
	rows?: number;
	/** Whether the field is required (adds asterisk to label) */
	required?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
} & Omit<React.ComponentProps<"textarea">, "name" | "form" | "value">;

function FormTextField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	placeholder,
	label,
	description,
	className,
	rows = 2,
	required = false,
	...props
}: FormTextFieldProps<TFieldValues>) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn(className)}>
					{label && (
						<FormLabel>
							{label}
							{required && (
								<span className="bold text-muted-foreground"> *</span>
							)}
						</FormLabel>
					)}
					<FormControl>
						<Textarea
							rows={rows}
							placeholder={placeholder}
							className="text-md md:text-sm" // FIXME: temporarily removed resize-none
							{...props}
							{...field}
						/>
					</FormControl>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export { FormTextField };
