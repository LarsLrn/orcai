import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import type { DropzoneProps } from "react-dropzone";
import { FileUploader } from "@/components/documents/file-uploader";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";

const UploadField = ({
	label,
	description,
	accept,
	maxSize,
	maxFileCount,
	multiple,
	disabled,
}: {
	label: string;
	description?: string;
	accept?: DropzoneProps["accept"];
	maxSize?: number;
	maxFileCount?: number;
	multiple?: boolean;
	disabled?: boolean;
}) => {
	const field = useFieldContext<File[]>();
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel className="font-bold" htmlFor={id}>
				{label}
			</FieldLabel>
			<FileUploader
				value={field.state.value ?? []}
				onValueChange={field.handleChange}
				accept={accept}
				maxSize={maxSize}
				maxFileCount={maxFileCount}
				multiple={multiple}
				disabled={disabled}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default UploadField;
