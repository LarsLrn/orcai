import { useSelector } from "@tanstack/react-store";
import { XIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
	const field = useFieldContext<number | undefined>();
	useFieldLabel(field, label);
	const id = useId();
	const extractNumberValue = (nextValue: number | readonly number[]) =>
		Array.isArray(nextValue) ? nextValue[0] : nextValue;

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);
	const storedValue = field.state.value;
	const isSet = typeof storedValue === "number";
	const value = isSet ? storedValue : restingValue;
	const valueText = formatValue ? formatValue(value) : String(value);

	return (
		<Field data-invalid={isInvalid}>
			<div className="flex items-center justify-between gap-3">
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
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
			<Slider
				id={id}
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
				aria-invalid={isInvalid}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default SliderField;
