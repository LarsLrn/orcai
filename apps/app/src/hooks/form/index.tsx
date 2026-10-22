import { createFormHook } from "@tanstack/react-form";
import { flushSync } from "react-dom";
import BlockEditorField from "@/components/forms/fields/block-editor-field";
import CheckboxField from "@/components/forms/fields/checkbox-field";
import CheckboxGroup from "@/components/forms/fields/checkbox-group";
import CodeField from "@/components/forms/fields/code-field";
import DatetimeField from "@/components/forms/fields/datetime-field";
import FormValidationErrors from "@/components/forms/fields/form-validation-errors";
import MultiSelectField from "@/components/forms/fields/multi-select-field";
import PasswordField from "@/components/forms/fields/password-field";
import RadioGroup from "@/components/forms/fields/radio-group";
import SelectField from "@/components/forms/fields/select-field";
import SliderField from "@/components/forms/fields/slider-field";
import SwitchField from "@/components/forms/fields/switch-field";
import TextField from "@/components/forms/fields/text-field";
import TextareaField from "@/components/forms/fields/textarea-field";
import UploadField from "@/components/forms/fields/upload-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldContext, formContext } from "./context";

const formHook = createFormHook({
	fieldComponents: {
		TextField,
		SelectField,
		MultiSelectField,
		TextareaField,
		SwitchField,
		RadioGroup,
		CheckboxGroup,
		CheckboxField,
		CodeField,
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

export const { withFieldGroup } = formHook;
