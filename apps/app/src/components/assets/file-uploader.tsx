import { FileText, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import Dropzone, {
	type DropzoneProps,
	type FileRejection,
} from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
	value: File[];
	onValueChange: (files: File[]) => void;
	/** Upload progress by file name. */
	progresses?: Record<string, number>;
	accept: DropzoneProps["accept"];
	maxSize: number;
	maxFileCount: number;
	multiple?: boolean;
	disabled?: boolean;
}

const FileUploader = (props: FileUploaderProps) => {
	const {
		value: files,
		onValueChange,
		progresses,
		accept,
		maxSize,
		maxFileCount,
		multiple = false,
		disabled = false,
		className,
		...dropzoneProps
	} = props;

	const onDrop = useCallback(
		(acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
			if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
				toast.error(m.assets_file_uploader_single_file_toast_error());
				return;
			}

			if (files.length + acceptedFiles.length > maxFileCount) {
				toast.error(
					m.assets_file_uploader_max_files_toast_error({
						count: maxFileCount,
					}),
				);
				return;
			}

			const newFiles = acceptedFiles.map((file) =>
				Object.assign(file, {
					preview: URL.createObjectURL(file),
				}),
			);

			onValueChange([
				...files,
				...newFiles,
			]);

			if (rejectedFiles.length > 0) {
				rejectedFiles.forEach(({ file }) => {
					toast.error(
						m.assets_file_uploader_rejected_toast_error({
							name: file.name,
						}),
					);
				});
			}
		},
		[
			files,
			maxFileCount,
			multiple,
			onValueChange,
		],
	);

	function onRemove(index: number) {
		onValueChange(files.filter((_, i) => i !== index));
	}

	// Preview URLs live until unmount, so the cleanup reads the latest files.
	const filesRef = useRef(files);
	useEffect(() => {
		filesRef.current = files;
	}, [
		files,
	]);
	useEffect(
		() => () => {
			for (const file of filesRef.current) {
				if (isFileWithPreview(file)) {
					URL.revokeObjectURL(file.preview);
				}
			}
		},
		[],
	);

	const isDisabled = disabled || files.length >= maxFileCount;

	return (
		<div className="relative flex flex-col gap-6 overflow-hidden">
			<Dropzone
				onDrop={onDrop}
				accept={accept}
				maxSize={maxSize}
				maxFiles={maxFileCount}
				multiple={maxFileCount > 1 || multiple}
				disabled={isDisabled}
			>
				{({ getRootProps, getInputProps, isDragActive }) => (
					<div
						{...getRootProps()}
						className={cn(
							"group border-muted-foreground/25 hover:bg-muted/25 relative grid h-52 w-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-5 py-2.5 text-center transition",
							"ring-offset-background focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
							isDragActive && "border-muted-foreground/50",
							isDisabled && "pointer-events-none opacity-60",
							className,
						)}
						{...dropzoneProps}
					>
						<input {...getInputProps()} />
						{isDragActive ? (
							<div className="flex flex-col items-center justify-center gap-4 sm:px-5">
								<div className="rounded-full border border-dashed p-3">
									<Upload
										className="text-muted-foreground size-7"
										aria-hidden="true"
									/>
								</div>
								<p className="text-muted-foreground font-medium">
									{m.assets_file_uploader_drop_active_label()}
								</p>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center gap-4 sm:px-5">
								<div className="rounded-full border border-dashed p-3">
									<Upload
										className="text-muted-foreground size-7"
										aria-hidden="true"
									/>
								</div>
								<div className="flex flex-col gap-px">
									<p className="text-muted-foreground font-medium">
										{m.assets_file_uploader_drop_idle_label()}
									</p>
									<p className="text-muted-foreground/70 text-sm">
										{maxFileCount === Number.POSITIVE_INFINITY
											? m.assets_file_uploader_limit_unlimited_hint({
													size: formatFileSize(maxSize),
												})
											: maxFileCount > 1
												? m.assets_file_uploader_limit_multiple_hint({
														count: maxFileCount,
														size: formatFileSize(maxSize),
													})
												: m.assets_file_uploader_limit_single_hint({
														size: formatFileSize(maxSize),
													})}
									</p>
								</div>
							</div>
						)}
					</div>
				)}
			</Dropzone>
			{files.length ? (
				<ScrollArea className="h-fit w-full px-3">
					<div className="flex max-h-48 flex-col gap-4">
						{files.map((file, index) => (
							<FileCard
								key={`${file.name}-${file.lastModified}`}
								file={file}
								onRemove={() => onRemove(index)}
								progress={progresses?.[file.name]}
							/>
						))}
					</div>
				</ScrollArea>
			) : null}
		</div>
	);
};

export { FileUploader };

interface FileCardProps {
	file: File;
	onRemove: () => void;
	progress?: number;
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
	return (
		<div className="relative flex items-center gap-2.5">
			<div className="flex flex-1 gap-2.5">
				{isFileWithPreview(file) ? <FilePreview file={file} /> : null}
				<div className="flex w-full flex-col gap-2">
					<div className="flex flex-col gap-px">
						<p className="text-foreground/80 line-clamp-1 text-sm font-medium">
							{file.name}
						</p>
						<p className="text-muted-foreground text-xs">
							{formatFileSize(file.size)}
						</p>
					</div>
					{progress ? <Progress value={progress} /> : null}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-7"
					onClick={onRemove}
				>
					<X className="size-4" aria-hidden="true" />
					<span className="sr-only">
						{m.assets_file_uploader_remove_file_button()}
					</span>
				</Button>
			</div>
		</div>
	);
}

function isFileWithPreview(file: File): file is File & {
	preview: string;
} {
	return "preview" in file && typeof file.preview === "string";
}

interface FilePreviewProps {
	file: File & {
		preview: string;
	};
}

function FilePreview({ file }: FilePreviewProps) {
	if (file.type.startsWith("image/")) {
		return (
			<img
				src={file.preview}
				alt={file.name}
				width={48}
				height={48}
				loading="lazy"
				className="aspect-square shrink-0 rounded-md object-cover"
			/>
		);
	}

	return (
		<FileText className="text-muted-foreground size-10" aria-hidden="true" />
	);
}
