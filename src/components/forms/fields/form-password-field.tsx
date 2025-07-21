import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FormPasswordFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** The label text for the form field */
	label?: string;
	/** Whether to show the password toggle button */
	showTogglePassword?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "type" | "form" | "value">;

function FormPasswordField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	placeholder,
	label,
	showTogglePassword = false,
	className,
	...props
}: FormPasswordFieldProps<TFieldValues>) {
	// The state for the password visibility toggle
	const [showPassword, setShowPassword] = useState(false);

	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn(className)}>
					{/* Render the label if it is defined */}
					{label && <FormLabel>{label}</FormLabel>}
					<FormControl>
						<div className="relative">
							<Input
								// If the password is visible, the type is text, otherwise it is password.
								type={showPassword ? "text" : "password"}
								placeholder={placeholder}
								// Pass through the field props
								{...props}
								{...field}
								value={field.value ?? ""}
								// Add padding-right if the toggle is shown
								className={cn(
									showTogglePassword ? "pr-14" : "",
									"text-md md:text-sm",
								)}
							/>
							{/* Render the toggle button if it is shown */}
							{showTogglePassword && (
								<div className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-0">
									<Button
										className="h-full w-12 rounded-l-none p-1 shadow-none"
										type="button"
										variant={"outline"}
										tabIndex={-1}
										onClick={() => setShowPassword(!showPassword)}
									>
										{/* Render the eye or eye off icon based on the state */}
										{showPassword ? <EyeOffIcon /> : <EyeIcon />}
									</Button>
								</div>
							)}
						</div>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export { FormPasswordField };
