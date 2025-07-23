import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { storageQueryOptions } from "@/lib/query-options/storage";
import { cn } from "@/lib/utils";
import type { BucketName } from "@/settings/buckets";
import type { FileType } from "@/types/file";

const DisplayPointImage = ({
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
		storageQueryOptions.createDownloadUrl({
			input: {
				id: imageRef.reference,
				prefix: imageRef.prefix,
				bucket: imageRef.bucket,
				type: imageRef.type,
			},
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

export { DisplayPointImage };
