import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import type { BucketName } from "@/settings/buckets";
import type { FileType } from "@/types/file";

const DisplayChunkImage = ({
	imageRef,
}: {
	imageRef: {
		reference: string;
		type: FileType;
		bucket: BucketName;
		prefix: string;
	};
}) => {
	const { data, status } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: imageRef.reference,
				prefix: imageRef.prefix,
				bucket: imageRef.bucket,
				type: imageRef.type,
			},
			queryKey: orpc.storage.createDownloadUrl.key(),
		}),
	);

	return (
		<div className="max-h-[100px] w-full">
			{status === "pending" && data && (
				<Skeleton className="h-[100px] w-full" />
			)}
			{status === "success" && (
				<img
					src={data.url}
					alt="test"
					width={100}
					height={100}
					className={cn("w-auto object-contain")}
					loading="lazy"
				/>
			)}
		</div>
	);
};

export { DisplayChunkImage };
