import { useSelector } from "@tanstack/react-store";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";
import { PasswordStrengthIndicator } from "@/components/forms/utility/password-strength-indicator";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldContext } from "@/hooks/form/context";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
	label: string;
	description?: string;
	showTogglePassword?: boolean;
	showStrength?: boolean;
} & React.ComponentProps<typeof Input>;

const PasswordField = ({
	label,
	description,
	showTogglePassword = false,
	showStrength = false,
	className,
	...props
}: PasswordFieldProps) => {
	const field = useFieldContext<string>();
	const id = useId();
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel className="font-bold" htmlFor={id}>
				{label}
			</FieldLabel>
			{description && <FieldDescription>{description}</FieldDescription>}
			<div className="relative">
				<Input
					id={id}
					name={field.name}
					type={isPasswordVisible ? "text" : "password"}
					value={field.state.value}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					aria-invalid={isInvalid}
					aria-describedby={showStrength ? `${id}-description` : undefined}
					className={cn(showTogglePassword && "pr-9", className)}
					{...props}
				/>
				{showTogglePassword && (
					<button
						className="absolute inset-e-0 inset-y-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onClick={() => setIsPasswordVisible(!isPasswordVisible)}
						tabIndex={-1}
						aria-label={isPasswordVisible ? "Hide password" : "Show password"}
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
			{isInvalid && <FieldError errors={errors} />}
			{showStrength && (
				<PasswordStrengthIndicator value={field.state.value} fieldName={id} />
			)}
		</Field>
	);
};

export default PasswordField;
