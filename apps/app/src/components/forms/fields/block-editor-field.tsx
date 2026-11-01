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
};

const BlockEditorField = ({ label, description }: BlockEditorFieldProps) => {
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
					}}
				/>
			</Suspense>
		</FormField>
	);
};

export default BlockEditorField;
