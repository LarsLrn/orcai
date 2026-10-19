/** Holds the empty editor's space until Tiptap has loaded and mounted. */
export const BlockEditorPlaceholder = () => (
	<div className="overflow-hidden rounded-md border">
		<div className="box-content hidden h-10 border-b sm:block" />
		<div className="min-h-[30vh]" />
	</div>
);
