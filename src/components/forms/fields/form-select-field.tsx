import { useId, useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
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
	options: { value: string; label: string }[];
	/** The placeholder text to display when no option is selected */
	placeholder: string;
	/** The label text for the form field */
	label?: string;
	/** The description text for the form field */
	description?: string;
	/** Whether the select box should be disabled */
	disabled?: boolean;
	/** The text to display in the checkbox that, when checked, sets the selected value to undefined and disables the select box */
	optOutLabel?: string;
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
	optOutLabel,
	required = false,
	className,
}: FormSelectFieldProps<TFieldValues>) {
	const [selected, setSelected] = useState<string | undefined | null>(
		undefined,
	);
	const [disableField, setDisableField] = useState<boolean>(false);

	const labelId = useId();

	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => {
				// Initialize selected state from field value
				if (selected === undefined && field.value) {
					setSelected(field.value);
				}

				/**
				 * Handles the change event of the select component.
				 *
				 * @param {string} value - The selected value from the select component.
				 * @return {void} This function does not return anything.
				 */
				const handleSelectChange = (value: string): void => {
					if (options.map((option) => option.value).includes(value)) {
						setSelected(value);
						field.onChange(value);
					} else {
						setSelected("");
						field.onChange(undefined);
					}
				};

				/**
				 * Handles the change event of the check component.
				 *
				 * @param {boolean} checked - The state of the check.
				 * @return {void} This function does not return anything.
				 */
				const handleCheckChange = (checked: boolean): void => {
					if (checked) {
						setSelected("");
						field.onChange(undefined);
					}

					setDisableField(checked);
				};

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
								onValueChange={handleSelectChange}
								value={(selected || field.value) as string}
								disabled={disableField || disabled}
							>
								<SelectTrigger>
									<SelectValue placeholder={placeholder} />
								</SelectTrigger>
								<SelectContent>
									{options.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormControl>
						{optOutLabel && (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={labelId}
									disabled={disabled}
									onCheckedChange={handleCheckChange}
								/>
								<label
									htmlFor={labelId}
									className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{optOutLabel}
								</label>
							</div>
						)}
						{description && <FormDescription>{description}</FormDescription>}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

export { FormSelectField };
