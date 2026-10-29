import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFormField } from "./form-field";

/**
 * With a placeholder the field may be unset: it then shows the placeholder,
 * rests the thumb on `restingValue`, and a set value can be cleared.
 */
const SliderField = ({
	label,
	description,
	placeholder,
	min,
	max,
	step = 0.1,
	restingValue,
	formatValue,
}: {
	label: string;
	description?: string;
	placeholder?: string;
	min: number;
	max: number;
	step?: number;
	restingValue: number;
	formatValue?: (value: number) => string;
}) => {
	const { field, ...state } = useFormField<number | undefined>(
		label,
		description,
	);
	const extractNumberValue = (nextValue: number | readonly number[]) =>
		Array.isArray(nextValue) ? nextValue[0] : nextValue;

	const storedValue = field.state.value;
	const isSet = typeof storedValue === "number";
	const value = isSet ? storedValue : restingValue;
	const valueText = formatValue ? formatValue(value) : String(value);

	return (
		<Field data-invalid={state.isInvalid}>
			<div className="flex items-center justify-between gap-3">
				<FieldLabel htmlFor={state.control.id}>{label}</FieldLabel>
				<div className="flex items-center gap-1">
					<span className="text-muted-foreground text-sm">
						{isSet ? valueText : placeholder}
					</span>
					{placeholder && isSet && (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={m.forms_slider_field_clear_aria_label({
								label,
							})}
							onClick={() => field.handleChange(undefined)}
						>
							<XIcon aria-hidden="true" />
						</Button>
					)}
				</div>
			</div>
			{description && (
				<FieldDescription id={state.hintId}>{description}</FieldDescription>
			)}
			{/* The root cannot take focus, so it stays out of the invalid-field focus. */}
			<Slider
				id={state.control.id}
				aria-describedby={state.control["aria-describedby"]}
				name={field.name}
				value={[
					value,
				]}
				min={min}
				max={max}
				step={step}
				className={cn(!isSet && "opacity-60")}
				getAriaLabel={() => label}
				getAriaValueText={(formattedValue) =>
					isSet ? formattedValue : (placeholder ?? formattedValue)
				}
				onValueChange={(nextValue) =>
					field.handleChange(
						extractNumberValue(nextValue as number | readonly number[]),
					)
				}
				onValueCommitted={(nextValue) => {
					field.handleChange(
						extractNumberValue(nextValue as number | readonly number[]),
					);
					field.handleBlur();
				}}
			/>
			{state.isInvalid && (
				<FieldError id={state.errorId} errors={state.errors} />
			)}
		</Field>
	);
};

export default SliderField;
