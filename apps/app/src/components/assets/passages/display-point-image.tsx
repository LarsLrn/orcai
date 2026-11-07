import {
	useQueryErrorResetBoundary,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { ImageOffIcon } from "lucide-react";
import { Suspense } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type PointImageProps = {
	assetId: string;
	objectKey: string;
};

const PointImageError = ({ onRetry }: { onRetry: () => void }) => (
	<Placeholder
		title={m.assets_point_image_error_title()}
		description={m.assets_point_image_error_description()}
		Icon={ImageOffIcon}
		className="bg-background min-h-52 rounded-lg border"
		actions={[
			{
				key: "retry",
				label: m.assets_point_image_retry(),
				onClick: onRetry,
			},
		]}
	/>
);

const PointImage = ({ assetId, objectKey }: PointImageProps) => {
	const { data } = useSuspenseQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: assetId,
				objectKey,
			},
		}),
	);

	return (
		<div className="bg-background overflow-hidden rounded-lg border">
			<img
				src={data.url}
				alt={m.assets_point_image_alt()}
				className="h-full max-h-80 w-full object-contain"
				loading="lazy"
			/>
		</div>
	);
};

/** A passage's image, streamed from the server; a failed link shows in its place only. */
const DisplayPointImage = (props: PointImageProps) => {
	const { reset: resetQuery } = useQueryErrorResetBoundary();

	return (
		<CatchBoundary
			getResetKey={() => props.objectKey}
			errorComponent={({ reset }) => (
				<PointImageError
					onRetry={() => {
						resetQuery();
						reset();
					}}
				/>
			)}
		>
			<Suspense
				fallback={<Skeleton className="aspect-4/3 w-full rounded-lg" />}
			>
				<PointImage {...props} />
			</Suspense>
		</CatchBoundary>
	);
};

export { DisplayPointImage };
