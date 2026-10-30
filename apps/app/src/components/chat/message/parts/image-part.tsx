import { DownloadIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { downloadImage } from "./download-image";

interface ImagePartProps {
	url: string;
	alt: string;
}

export const ImagePart = ({ url, alt }: ImagePartProps) => {
	const handleDownloadImage = () => {
		try {
			downloadImage(url);
			toast.success(m.chat_image_part_download_toast_success());
		} catch (_error) {
			toast.error(m.chat_image_part_download_toast_error());
		}
	};

	return (
		<div className="mb-6 space-y-4">
			<div className="flex items-center space-x-2 text-muted-foreground text-sm">
				<ImageIcon className="h-4 w-4" />
				<span>{m.chat_image_part_label()}</span>
			</div>

			<div className="group relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm transition-all hover:shadow-md">
				<img
					src={url}
					alt={alt}
					width={400}
					height={400}
					className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
				/>
				<Button
					size="sm"
					variant="default"
					className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
					onClick={handleDownloadImage}
					title={m.chat_image_part_download_action()}
				>
					<DownloadIcon className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
