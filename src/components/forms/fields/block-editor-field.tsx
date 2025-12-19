import { useStore } from "@tanstack/react-form";
import type { Content } from "@tiptap/core";
import { useId } from "react";
import { BlockEditor } from "@/components/editor";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";

type BlockEditorFieldProps = {
	label: string;
	description?: string;
	/** Field name to sync HTML content to (optional) */
	htmlFieldName?: string;
};

const BlockEditorField = ({
	label,
	description,
	htmlFieldName,
}: BlockEditorFieldProps) => {
	const field = useFieldContext<Content>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<BlockEditor
				content={field.state.value}
				onUpdate={(editor) => {
					field.handleChange(editor.getJSON() as Content);
					if (htmlFieldName) {
						field.form.setFieldValue(
							htmlFieldName as never,
							editor.getHTML() as never,
						);
					}
				}}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default BlockEditorField;
