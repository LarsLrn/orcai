import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FormSelectFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** An array of objects with value and label properties, used to populate the options of the select box */
	options: { value: string; label: string }[] | undefined;
	/** The placeholder text to display when no option is selected */
	placeholder: string;
	/** The label text for the form field */
	label?: string;
	/** The description text for the form field */
	description?: string;
	/** Whether the select box should be disabled */
	disabled?: boolean;
	/** Callback function when the value changes */
	onValueChange?: (value: string | undefined) => void;
	/** Whether the field is required (adds asterisk to label) */
	required?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
};

function FormSelectField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	options,
	placeholder,
	label,
	description,
	disabled = false,
	onValueChange,
	required = false,
	className,
}: FormSelectFieldProps<TFieldValues>) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => {
				return (
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
							<Select
								onValueChange={(value) => {
									field.onChange(value);
									onValueChange?.(value);
								}}
								value={field.value}
								disabled={disabled}
							>
								<SelectTrigger>
									<SelectValue placeholder={placeholder} />
								</SelectTrigger>
								<SelectContent>
									{options?.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormControl>
						{description && <FormDescription>{description}</FormDescription>}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

export { FormSelectField };
