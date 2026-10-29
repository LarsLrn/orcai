import type { Content } from "@tiptap/core";
import { lazy, Suspense } from "react";
import { BlockEditorPlaceholder } from "@/components/editor/block-editor-placeholder";
import { FormField, useFormField } from "./form-field";

// Tiptap is large, so only the editor waits for its chunk while the form hydrates.
const BlockEditor = lazy(() =>
	import("@/components/editor/block-editor").then((module) => ({
		default: module.BlockEditor,
	})),
);

type BlockEditorFieldProps = {
	label: string;
	description?: string;
	/** Field name to sync HTML content to (optional) */
	htmlFieldName?: string;
};

const resolveSiblingFieldName = (fieldName: string, siblingField: string) => {
	if (siblingField.includes(".") || siblingField.includes("[")) {
		return siblingField;
	}

	return fieldName.replace(/[^.[\]]+$/u, siblingField);
};

const BlockEditorField = ({
	label,
	description,
	htmlFieldName,
}: BlockEditorFieldProps) => {
	const { field, ...state } = useFormField<Content>(label, description);

	return (
		<FormField state={state} label={label} description={description}>
			<Suspense fallback={<BlockEditorPlaceholder />}>
				<BlockEditor
					labelledBy={state.labelId}
					describedBy={state.control["aria-describedby"]}
					content={field.state.value}
					onUpdate={(editor) => {
						field.handleChange(editor.getJSON() as Content);
						if (htmlFieldName) {
							const htmlTargetFieldName = resolveSiblingFieldName(
								String(field.name),
								htmlFieldName,
							);
							field.form.setFieldValue(
								htmlTargetFieldName as never,
								editor.getHTML() as never,
							);
						}
					}}
				/>
			</Suspense>
		</FormField>
	);
};

export default BlockEditorField;
