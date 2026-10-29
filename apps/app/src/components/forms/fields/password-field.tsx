import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { PasswordStrengthIndicator } from "@/components/forms/utility/password-strength-indicator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { type ControlWidth, FormField, useFormField } from "./form-field";

type PasswordFieldProps = {
	label: string;
	description?: string;
	showTogglePassword?: boolean;
	showStrength?: boolean;
	width?: ControlWidth;
} & React.ComponentProps<typeof Input>;

const PasswordField = ({
	label,
	description,
	showTogglePassword = false,
	showStrength = false,
	width,
	className,
	...props
}: PasswordFieldProps) => {
	const { field, ...state } = useFormField<string>(label, description);
	const { id } = state.control;
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const describedBy = [
		state.control["aria-describedby"],
		showStrength && `${id}-description`,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<FormField
			state={state}
			label={label}
			description={description}
			width={width}
		>
			<div className="relative">
				<Input
					{...props}
					{...state.control}
					aria-describedby={describedBy || undefined}
					name={field.name}
					type={isPasswordVisible ? "text" : "password"}
					value={field.state.value}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					className={cn(showTogglePassword && "pr-9", className)}
				/>
				{showTogglePassword && (
					<button
						className="absolute inset-e-0 inset-y-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onClick={() => setIsPasswordVisible(!isPasswordVisible)}
						tabIndex={-1}
						aria-label={
							isPasswordVisible
								? m.forms_password_field_hide_button()
								: m.forms_password_field_show_button()
						}
						aria-pressed={isPasswordVisible}
						aria-controls={id}
					>
						{isPasswordVisible ? (
							<EyeOffIcon size={16} aria-hidden="true" />
						) : (
							<EyeIcon size={16} aria-hidden="true" />
						)}
					</button>
				)}
			</div>
			{showStrength && (
				<PasswordStrengthIndicator value={field.state.value} fieldName={id} />
			)}
		</FormField>
	);
};

export default PasswordField;
