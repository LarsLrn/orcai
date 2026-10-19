import { useSelector } from "@tanstack/react-store";
import type { Content } from "@tiptap/core";
import { lazy, Suspense, useId } from "react";
import { BlockEditorPlaceholder } from "@/components/editor/block-editor-placeholder";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";

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
	const field = useFieldContext<Content>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel id={id}>{label}</FieldLabel>
			<Suspense fallback={<BlockEditorPlaceholder />}>
				<BlockEditor
					labelledBy={id}
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
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default BlockEditorField;
