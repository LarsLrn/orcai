import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { PasswordStrengthIndicator } from "@/components/forms/utility/password-strength-indicator";
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
	/** Whether to show the password strength indicator */
	showStrength?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "type" | "form" | "value">;

function FormPasswordField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	placeholder,
	label,
	showTogglePassword = false,
	showStrength = false,
	className,
	...props
}: FormPasswordFieldProps<TFieldValues>) {
	// The state for the password visibility toggle
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);

	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => {
				return (
					<FormItem className={cn(className)}>
						{/* Render the label if it is defined */}
						{label && <FormLabel>{label}</FormLabel>}
						<FormControl>
							<div className="relative">
								<Input
									id={field.name}
									type={isPasswordVisible ? "text" : "password"}
									placeholder={placeholder}
									{...props}
									{...field}
									value={field.value ?? ""}
									aria-describedby={`${field.name}-description`}
								/>
								{/* Render the toggle button if it is shown */}
								{showTogglePassword && (
									<button
										className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
										type="button"
										onClick={() => setIsPasswordVisible(!isPasswordVisible)}
										tabIndex={-1}
										aria-label={
											isPasswordVisible ? "Hide password" : "Show password"
										}
										aria-pressed={isPasswordVisible}
										aria-controls="password"
									>
										{isPasswordVisible ? (
											<EyeOffIcon size={16} aria-hidden="true" />
										) : (
											<EyeIcon size={16} aria-hidden="true" />
										)}
									</button>
								)}
							</div>
						</FormControl>
						<FormMessage />
						{showStrength && (
							<PasswordStrengthIndicator
								value={field.value}
								fieldName={field.name}
							/>
						)}
					</FormItem>
				);
			}}
		/>
	);
}

export { FormPasswordField };
