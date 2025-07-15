import { useId, useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
	FormControl,
	FormDescription,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type InputTypes = "number" | "text" | "email";

/**
 * Renders a form input field component.
 *
 * @param {ControllerRenderProps<any, any>} field - The field object for the form.
 * @param {InputTypes} inputType - The type of input field.
 * @param {string} placeholder - The placeholder text for the input field.
 * @param {string} [label] - The label text for the form field.
 * @param {string} [description] - The description text for the form field.
 * @param {string} [className] - The additional CSS class name for the component.
 * @param {boolean} [showSwitch] - Determines if a switch is shown.
 * @param {string} [unit] - The unit for the input field.
 * @param {string} [optOutLabel] - The label for opting out.
 * @param {boolean} [disabled=false] - Indicates if the field is disabled.
 * @return {ReactNode} The rendered form input field component.
 */
const FormInputField = ({
	field,
	inputType,
	placeholder,
	label,
	description,
	className,
	showSwitch,
	unit,
	optOutLabel,
	loading = false,
	disabled = false,
	required = false,
}: {
	field: ControllerRenderProps<any, any>;
	inputType: InputTypes;
	placeholder: string;
	label?: string;
	description?: string;
	className?: string;
	showSwitch?: boolean;
	unit?: string;
	optOutLabel?: string;
	loading?: boolean;
	disabled?: boolean;
	required?: boolean;
}) => {
	const [disableField, setDisableField] = useState<boolean>(false);
	const [visible, setVisible] = useState(
		showSwitch ? Boolean(field.value) : true,
	);

	const labelId = useId();

	/**
	 * Handles the switch change event.
	 *
	 * @param {boolean} state - The state of the switch.
	 */
	const handleSwitchChange = (state: boolean) => {
		if (state) {
			setVisible(true);
		} else {
			setVisible(false);
			clearField();
		}
	};

	/**
	 * Handles the check change event.
	 *
	 * @param {boolean} checked - The state of the check.
	 * @return {void} No return value.
	 */
	const handleCheckChange = (checked: boolean) => {
		if (checked) {
			clearField();
		}

		setDisableField(checked);
	};

	/**
	 * Clears the field by setting its value to undefined and calling the onChange function with undefined as the argument.
	 *
	 * @return {void} This function does not return anything.
	 */
	const clearField = () => {
		field.value = undefined;
		field.onChange(undefined);
	};

	if (loading) {
		return (
			<>
				{label && (
					<FormLabel>
						{label}
						{required && <span className="bold text-muted-foreground"> *</span>}
					</FormLabel>
				)}
				<Skeleton className="h-9" />
			</>
		);
	}

	return (
		<FormItem className={cn(className)}>
			{showSwitch ? (
				<div className="flex items-center space-x-2">
					<Switch
						checked={visible}
						onCheckedChange={handleSwitchChange}
						id={field.name}
					/>
					<FormLabel htmlFor={field.name}>{label}</FormLabel>
				</div>
			) : (
				label && (
					<FormLabel>
						{label}
						{required && <span className="bold text-muted-foreground"> *</span>}
					</FormLabel>
				)
			)}
			{visible && (
				<FormControl>
					<div className="relative">
						<Input
							type={inputType}
							placeholder={placeholder}
							{...field}
							value={field.value ?? ""}
							disabled={disableField || disabled}
							className="text-md [appearance:textfield] md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
			)}
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

export { FormInputField };
