import type { OrganizationDescription } from "@orcai/schema";
import { lazy, Suspense } from "react";
import { DescriptionEditorPlaceholder } from "@/components/editor/description-editor-placeholder";
import { FormField, useFormField } from "./form-field";

// Tiptap is large, so only the editor waits for its chunk while the form hydrates.
const DescriptionEditor = lazy(() =>
	import("@/components/editor/description-editor").then((module) => ({
		default: module.DescriptionEditor,
	})),
);

/** Rich text of headings, lists and links; an empty editor is `null`. */
const DescriptionEditorField = ({
	label,
	description,
}: {
	label: string;
	description?: string;
}) => {
	const { field, ...state } = useFormField<OrganizationDescription | null>(
		label,
		description,
	);

	return (
		<FormField state={state} label={label} description={description}>
			<Suspense fallback={<DescriptionEditorPlaceholder />}>
				<DescriptionEditor
					labelledBy={state.labelId}
					describedBy={state.control["aria-describedby"]}
					invalid={state.isInvalid}
					content={field.state.value}
					onUpdate={(editor) => {
						field.handleChange(
							editor.isEmpty
								? null
								: (editor.getJSON() as OrganizationDescription),
						);
					}}
					onBlur={field.handleBlur}
				/>
			</Suspense>
		</FormField>
	);
};

export default DescriptionEditorField;
