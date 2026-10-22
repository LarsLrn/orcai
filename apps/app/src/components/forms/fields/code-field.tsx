import { useSelector } from "@tanstack/react-store";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";

const CODE_LENGTH = 6;

/** A six-digit one-time code, one box per digit. */
const CodeField = ({
	label,
	description,
	autoFocus,
}: {
	label: string;
	description?: string;
	autoFocus?: boolean;
}) => {
	const field = useFieldContext<string>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{description && <FieldDescription>{description}</FieldDescription>}
			<InputOTP
				id={id}
				name={field.name}
				maxLength={CODE_LENGTH}
				pattern={REGEXP_ONLY_DIGITS}
				autoComplete="one-time-code"
				autoFocus={autoFocus}
				value={field.state.value}
				onChange={field.handleChange}
				onBlur={field.handleBlur}
				aria-invalid={isInvalid}
			>
				<InputOTPGroup>
					{Array.from(
						{
							length: CODE_LENGTH,
						},
						(_, index) => (
							<InputOTPSlot
								key={index}
								index={index}
								aria-invalid={isInvalid}
							/>
						),
					)}
				</InputOTPGroup>
			</InputOTP>
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default CodeField;
