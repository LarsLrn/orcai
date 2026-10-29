import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { FormField, useFormField } from "./form-field";

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
	const { field, ...state } = useFormField<string>(label, description);

	return (
		<FormField state={state} label={label} description={description}>
			<InputOTP
				{...state.control}
				name={field.name}
				maxLength={CODE_LENGTH}
				pattern={REGEXP_ONLY_DIGITS}
				autoComplete="one-time-code"
				autoFocus={autoFocus}
				value={field.state.value}
				onChange={field.handleChange}
				onBlur={field.handleBlur}
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
								aria-invalid={state.isInvalid}
							/>
						),
					)}
				</InputOTPGroup>
			</InputOTP>
		</FormField>
	);
};

export default CodeField;
