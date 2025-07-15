import { useId, useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
	FormDescription,
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

/**
 * Renders a form select component with options and optional opt-out label.
 *
 * @param {ControllerRenderProps<any, any>} field - The field object provided by react-hook-form's Controller component.
 * @param {Array<{ value: string; label: string }>} options - An array of objects with value and label properties, used to populate the options of the select box.
 * @param {string} placeholder - The placeholder text to display when no option is selected.
 * @param {string} [label] - The label text to display above the select box.
 * @param {string} [description] - The description text to display below the select box.
 * @param {boolean} [disabled=false] - Whether the select box should be disabled.
 * @param {string} [optOutLabel] - The text to display in the checkbox that, when checked, sets the selected value to undefined and disables the select box.
 * @param {string} [className] - The class name to apply to the form item container div.
 * @return {ReactNode} The rendered form select component.
 */
const FormSelect = ({
	field,
	options,
	placeholder,
	label,
	description,
	disabled = false,
	optOutLabel,
	className,
	required = false,
}: {
	field: ControllerRenderProps<any, any>;
	options: { value: string; label: string }[];
	placeholder: string;
	label?: string;
	description?: string;
	disabled?: boolean;
	optOutLabel?: string;
	className?: string;
	required?: boolean;
}) => {
	const [selected, setSelected] = useState<string | undefined | null>(
		field.value || undefined,
	);
	const [disableField, setDisableField] = useState<boolean>(false);

	const labelId = useId();

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
					{required && <span className="bold text-muted-foreground"> *</span>}
				</FormLabel>
			)}
			<Select
				onValueChange={handleSelectChange}
				value={selected as string}
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
};

export { FormSelect };
