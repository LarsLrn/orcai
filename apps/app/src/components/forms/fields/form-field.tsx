import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";

/** Below sm every control is full width. */
const CONTROL_WIDTHS = {
	number: "sm:max-w-44",
	short: "sm:max-w-xs",
	medium: "sm:max-w-md",
	full: "",
} as const;

type ControlWidth = keyof typeof CONTROL_WIDTHS;

/** Ids, validity and the props a field's control needs to reference its label, hint and error. */
const useFormField = <TValue,>(label: string, description?: string) => {
	const field = useFieldContext<TValue>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	const labelId = `${id}-label`;
	const hintId = description ? `${id}-hint` : undefined;
	const errorId = isInvalid ? `${id}-error` : undefined;
	const describedBy = [
		hintId,
		errorId,
	]
		.filter(Boolean)
		.join(" ");

	return {
		field,
		errors,
		isInvalid,
		labelId,
		hintId,
		errorId,
		control: {
			id,
			"aria-invalid": isInvalid,
			"aria-describedby": describedBy || undefined,
		},
	};
};

type FormFieldState = Omit<ReturnType<typeof useFormField>, "field">;

/**
 * Label, hint, control, error. In a FormPair the rows join the pair's subgrid
 * so paired controls line up even when one hint is longer or missing.
 */
const FormField = ({
	state,
	label,
	description,
	width = "full",
	children,
}: {
	state: FormFieldState;
	label: string;
	description?: string;
	width?: ControlWidth;
	children: React.ReactNode;
}) => (
	<Field data-invalid={state.isInvalid}>
		<FieldLabel
			id={state.labelId}
			htmlFor={state.control.id}
			className="sm:row-start-1"
		>
			{label}
		</FieldLabel>
		{description && (
			<FieldDescription id={state.hintId} className="sm:row-start-2">
				{description}
			</FieldDescription>
		)}
		<div className="flex flex-col gap-2 sm:row-start-3">
			<div className={CONTROL_WIDTHS[width]}>{children}</div>
			{state.isInvalid && (
				<FieldError id={state.errorId} errors={state.errors} />
			)}
		</div>
	</Field>
);

/** Form triggers match the 16 px text inputs below md, so iOS does not zoom on focus. */
const formTriggerText = "text-base md:text-sm";

export type { ControlWidth };
export { FormField, formTriggerText, useFormField };
