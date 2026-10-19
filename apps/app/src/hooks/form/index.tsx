import { createFormHook } from "@tanstack/react-form";
import { lazy } from "react";
import { flushSync } from "react-dom";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldContext, formContext } from "./context";

const TextField = lazy(() => import("@/components/forms/fields/text-field"));
const SelectField = lazy(
	() => import("@/components/forms/fields/select-field"),
);
const MultiSelectField = lazy(
	() => import("@/components/forms/fields/multi-select-field"),
);
const TextareaField = lazy(
	() => import("@/components/forms/fields/textarea-field"),
);
const SwitchField = lazy(
	() => import("@/components/forms/fields/switch-field"),
);
const RadioGroup = lazy(() => import("@/components/forms/fields/radio-group"));
const CheckboxGroup = lazy(
	() => import("@/components/forms/fields/checkbox-group"),
);
const DatetimeField = lazy(
	() => import("@/components/forms/fields/datetime-field"),
);
const PasswordField = lazy(
	() => import("@/components/forms/fields/password-field"),
);
const BlockEditorField = lazy(
	() => import("@/components/forms/fields/block-editor-field"),
);
const UploadField = lazy(
	() => import("@/components/forms/fields/upload-field"),
);
const SliderField = lazy(
	() => import("@/components/forms/fields/slider-field"),
);
const FormValidationErrors = lazy(
	() => import("@/components/forms/fields/form-validation-errors"),
);

const formHook = createFormHook({
	fieldComponents: {
		TextField,
		SelectField,
		MultiSelectField,
		TextareaField,
		SwitchField,
		RadioGroup,
		CheckboxGroup,
		DatetimeField,
		PasswordField,
		BlockEditorField,
		UploadField,
		SliderField,
	},
	formComponents: {
		SubmitButton,
		FormValidationErrors,
	},
	fieldContext,
	formContext,
});

// Once a submission is rejected, render the invalid fields and move to the first.
const focusFirstInvalidField = () => {
	flushSync(() => undefined);
	const scope = document.activeElement?.closest("form") ?? document;
	scope.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
};

export const useAppForm: typeof formHook.useAppForm = (props) =>
	formHook.useAppForm({
		...props,
		onSubmitInvalid: (invalid) => {
			focusFirstInvalidField();
			props.onSubmitInvalid?.(invalid);
		},
	});

export const { withForm, withFieldGroup } = formHook;
