import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { FileUploader } from "@/components/documents/file-uploader";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { m } from "@/paraglide/messages";
import { cropToWebp, WebpExportUnsupported } from "./crop-image";

const ACCEPT = {
	"image/png": [
		".png",
	],
	"image/jpeg": [
		".jpg",
		".jpeg",
	],
	"image/webp": [
		".webp",
	],
	"image/gif": [
		".gif",
	],
};

const MAX_SOURCE_SIZE = 10 * 1024 * 1024;

const MAX_ZOOM = 4;

/**
 * Picks one image, crops it to a square with zoom, and hands the 256-pixel
 * WebP to `onSave`; the dialog closes once that resolves to true.
 */
export const ImageUploadDialog = ({
	open,
	onOpenChange,
	shape,
	title,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	shape: "round" | "rect";
	title: string;
	onSave: (image: Blob) => Promise<boolean>;
}) => {
	const [source, setSource] = useState<{
		file: File;
		url: string;
	} | null>(null);
	const [crop, setCrop] = useState({
		x: 0,
		y: 0,
	});
	const [zoom, setZoom] = useState(1);
	const [area, setArea] = useState<Area | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const choose = (file: File | undefined) => {
		if (source) URL.revokeObjectURL(source.url);
		setSource(
			file
				? {
						file,
						url: URL.createObjectURL(file),
					}
				: null,
		);
		setCrop({
			x: 0,
			y: 0,
		});
		setZoom(1);
		setArea(null);
		setError(null);
	};

	const close = (next: boolean) => {
		if (!next) choose(undefined);
		onOpenChange(next);
	};

	const save = async () => {
		if (!source || !area) return;
		setSaving(true);
		setError(null);
		try {
			const image = await cropToWebp(source.file, area);
			if (await onSave(image)) close(false);
		} catch (cause) {
			setError(
				cause instanceof WebpExportUnsupported
					? m.images_dialog_webp_unsupported_error()
					: m.images_dialog_read_error(),
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="flex max-h-[90dvh] flex-col">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{m.images_dialog_description()}</DialogDescription>
				</DialogHeader>
				<DialogBody>
					{source ? (
						<div className="flex flex-col gap-4">
							<div className="relative h-[min(18rem,45dvh)] w-full overflow-hidden rounded-md bg-muted">
								<Cropper
									image={source.url}
									crop={crop}
									zoom={zoom}
									maxZoom={MAX_ZOOM}
									aspect={1}
									cropShape={shape}
									showGrid={false}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onCropComplete={(_, pixels) => setArea(pixels)}
									onMediaLoaded={() => setError(null)}
								/>
							</div>
							<Slider
								value={[
									zoom,
								]}
								min={1}
								max={MAX_ZOOM}
								step={0.05}
								getAriaLabel={() => m.images_dialog_zoom_label()}
								onValueChange={(value) =>
									setZoom(Array.isArray(value) ? (value[0] ?? 1) : value)
								}
							/>
						</div>
					) : (
						<FileUploader
							value={[]}
							onValueChange={(files) => choose(files[0])}
							accept={ACCEPT}
							maxSize={MAX_SOURCE_SIZE}
							maxFileCount={1}
						/>
					)}
					{error ? (
						<p role="alert" className="mt-4 text-destructive text-sm">
							{error}
						</p>
					) : null}
				</DialogBody>
				<DialogFooter>
					{source ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => choose(undefined)}
							disabled={saving}
						>
							{m.images_dialog_choose_other_button()}
						</Button>
					) : null}
					<Button
						type="button"
						onClick={save}
						disabled={!area || saving}
						loading={saving}
					>
						{m.common_save_button()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
