import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useFieldContext } from "@/hooks/form/context";

const SliderField = ({
	label,
	description,
	min,
	max,
	step = 0.1,
	defaultValue,
	formatValue,
}: {
	label: string;
	description?: string;
	min: number;
	max: number;
	step?: number;
	defaultValue: number;
	formatValue?: (value: number) => string;
}) => {
	const field = useFieldContext<number>();
	const id = useId();
	const extractNumberValue = (nextValue: number | readonly number[]) =>
		Array.isArray(nextValue) ? nextValue[0] : nextValue;

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);
	const value =
		typeof field.state.value === "number" ? field.state.value : defaultValue;

	return (
		<Field data-invalid={isInvalid}>
			<div className="flex items-center justify-between gap-3">
				<FieldLabel className="font-bold" htmlFor={id}>
					{label}
				</FieldLabel>
				<span className="text-muted-foreground text-sm">
					{formatValue ? formatValue(value) : value}
				</span>
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
