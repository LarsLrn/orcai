import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@orcai/schema";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { type ControlWidth, FormField, useFormField } from "./form-field";

type PasswordFieldProps = {
	label: string;
	description?: string;
	showTogglePassword?: boolean;
	showLimits?: boolean;
	width?: ControlWidth;
} & React.ComponentProps<typeof Input>;

const PasswordField = ({
	label,
	description: descriptionProp,
	showTogglePassword = false,
	showLimits = false,
	width,
	className,
	...props
}: PasswordFieldProps) => {
	const description =
		descriptionProp ??
		(showLimits
			? m.forms_password_limits_hint({
					min: PASSWORD_MIN_LENGTH,
					max: PASSWORD_MAX_LENGTH,
				})
			: undefined);
	const { field, ...state } = useFormField<string>(label, description);
	const { id } = state.control;
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
					name={field.name}
					type={isPasswordVisible ? "text" : "password"}
					value={field.state.value}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					className={cn(showTogglePassword && "pr-9", className)}
				/>
				{showTogglePassword && (
					<button
						className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 inset-e-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
		</FormField>
	);
};

export default PasswordField;
