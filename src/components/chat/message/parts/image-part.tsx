import { DownloadIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ImagePartProps {
	url: string;
	alt: string;
}

export const ImagePart = ({ url, alt }: ImagePartProps) => {
	const handleDownloadImage = (imageData: string, filename: string) => {
		try {
			// Convert base64 to blob
			const byteCharacters = atob(imageData);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: "image/png" });

			// Create download link
			const downloadUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = `generated-image-${filename.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(downloadUrl);

			toast.success("Image downloaded successfully!");
		} catch (_error) {
			toast.error("Failed to download image");
		}
	};

	return (
		<div className="mb-6 space-y-4">
			<div className="flex items-center space-x-2 text-muted-foreground text-sm">
				<ImageIcon className="h-4 w-4" />
				<span>Generated Image</span>
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
					onClick={() => handleDownloadImage(url, alt)}
					title="Download image"
				>
					<DownloadIcon className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
