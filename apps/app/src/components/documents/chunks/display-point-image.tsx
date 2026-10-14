import { useQuery } from "@tanstack/react-query";
import { ImageOffIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const DisplayPointImage = ({
	assetId,
	objectKey,
}: {
	assetId: string;
	objectKey: string;
}) => {
	const { data, status } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: assetId,
				objectKey,
			},
		}),
	);

	if (status === "pending") {
		return <Skeleton className="aspect-4/3 w-full rounded-lg" />;
	}

	if (status === "error") {
		return (
			<Placeholder
				title={m.assets_point_image_error_title()}
				description={m.assets_point_image_error_description()}
				Icon={ImageOffIcon}
				className="min-h-52 rounded-lg border bg-background"
			/>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border bg-background">
			<img
				src={data.url}
				alt={m.assets_point_image_alt()}
				className="h-full max-h-80 w-full object-contain"
				loading="lazy"
			/>
		</div>
	);
};

export { DisplayPointImage };
