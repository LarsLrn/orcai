import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputTypes = "number" | "text" | "email" | "url" | "tel";

type FormInputFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** The type of input field */
	inputType: InputTypes;
	/** The label text for the form field */
	label?: string;
	/** The description text for the form field */
	description?: string;
	/** The unit to display on the right side of the input */
	unit?: string;
	/** Additional CSS class name for the component */
	className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "type" | "form" | "value">;

function FormInputField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	inputType,
	placeholder,
	label,
	description,
	unit,
	className,
	required, // Extract required prop to prevent it from being passed to input
	...props
}: FormInputFieldProps<TFieldValues>) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn(className)}>
					{label && <FormLabel>{label}</FormLabel>}
					<FormControl>
						<div className="relative">
							<Input
								type={inputType}
								placeholder={placeholder}
								{...props}
								{...field}
								className={cn(
									"text-md [appearance:textfield] md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
									unit && "pr-16", // Add padding when unit is present
								)}
							/>
							{unit && (
								<div className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-0">
									<div className="inline-flex h-full min-w-14 items-center justify-center whitespace-nowrap rounded-md rounded-l-none border-l p-1 font-mono text-muted-foreground text-sm">
										{unit}
									</div>
								</div>
							)}
						</div>
					</FormControl>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export { FormInputField };
