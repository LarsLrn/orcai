import type { Asset, StorageUploadRoute } from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { useUploadFiles } from "@/components/documents/use-upload-files";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export type UploadFailure = {
	name: string;
	message: string;
};

export type AssetIntakeOutcome = {
	assets: Asset[];
	failures: UploadFailure[];
	/** From the create call, so later reads see the new assets. */
	zedToken: string | undefined;
};

/**
 * Uploads files and creates their assets in one step. Pending covers the
 * transfer and the create call; unmounting mid-transfer aborts it.
 */
export const useAssetIntake = ({ route }: { route: StorageUploadRoute }) => {
	const upload = useUploadFiles({
		route,
	});
	const { mutateAsync: createFromUploads, isPending: isCreating } = useMutation(
		orpc.asset.createFromUploads.mutationOptions(),
	);

	const intake = async (files: File[]): Promise<AssetIntakeOutcome> => {
		const uploaded = await upload.uploadAsync(files);
		const failures: UploadFailure[] = uploaded.failedFiles.map((file) => ({
			name: file.name,
			message: file.error.message,
		}));

		if (uploaded.files.length === 0) {
			return {
				assets: [],
				failures,
				zedToken: undefined,
			};
		}

		const { data: results, meta } = await createFromUploads({
			route,
			files: uploaded.files.map((file) => ({
				objectKey: file.objectKey,
				objectMetadata: file.objectMetadata,
				name: file.name,
				size: file.size,
				type: file.type,
			})),
		});

		const names = new Map(
			uploaded.files.map((file) => [
				file.objectKey,
				file.name,
			]),
		);

		return {
			assets: results.flatMap((result) =>
				result.status === "created"
					? [
							result.asset,
						]
					: [],
			),
			failures: [
				...failures,
				...results.flatMap((result) =>
					result.status === "failed"
						? [
								{
									name:
										names.get(result.objectKey) ??
										m.assets_upload_progress_file_error_label(),
									message: reasonMessage(result.reason, result.params),
								},
							]
						: [],
				),
			],
			zedToken: meta?.zedToken,
		};
	};

	return {
		intake,
		control: upload.control,
		reset: upload.reset,
		isPending: upload.isPending || isCreating,
	};
};
