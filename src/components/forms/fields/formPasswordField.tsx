import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	FormControl,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * FormPasswordField component.
 *
 * Renders a form password field component.
 *
 * @param {ControllerRenderProps<any, any>} field - The field object for the form.
 * @param {string} placeholder - The placeholder text for the input field.
 * @param {string} [label] - The label text for the form field.
 * @param {boolean} [showTogglePassword=false] - Determines if the password toggle is shown.
 * @param {string} [className] - The additional CSS class name for the component.
 * @returns {ReactNode} The rendered form password field component.
 */
const FormPasswordField = ({
	field,
	placeholder,
	label,
	showTogglePassword = false,
	className,
}: {
	field: ControllerRenderProps<any, any>;
	placeholder: string;
	label?: string;
	showTogglePassword?: boolean;
	className?: string;
}) => {
	// The state for the password visibility toggle
	const [showPassword, setShowPassword] = useState(false);

	return (
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
	);
};

export { FormPasswordField };
