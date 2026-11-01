import { ASSET_UPLOAD_ACCEPT } from "@orcai/s3/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { describeUploadFailures } from "@/components/assets/describe-upload-failures";
import { FileUploader } from "@/components/assets/file-uploader";
import { UploadProgress } from "@/components/assets/upload-progress";
import {
	type AssetIntakeOutcome,
	useAssetIntake,
} from "@/components/assets/use-asset-intake";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { m } from "@/paraglide/messages";

/** Compact drops the Card chrome and the title, for a message column. */
type UploadVariant = "page" | "compact";

/** Picks files, uploads them and creates their assets in one click. */
const UploadComponent = ({
	title,
	description,
	uploadLabel,
	variant = "page",
	maxFileCount = 100,
	onPendingChange,
	onCreated,
}: {
	title?: string;
	description?: string;
	uploadLabel?: string;
	variant?: UploadVariant;
	maxFileCount?: number;
	/** True from the click until the assets exist. */
	onPendingChange?: (pending: boolean) => void;
	onCreated: (outcome: AssetIntakeOutcome) => void;
}) => {
	const [files, setFiles] = useState<File[]>([]);
	const { intake, control, reset, isPending } = useAssetIntake({
		route: "asset",
	});

	const progresses = useMemo(
		() =>
			Object.fromEntries(
				control.progresses.map((file) => [
					file.name,
					Math.round(file.progress * 100),
				]),
			),
		[
			control.progresses,
		],
	);

	const handleUpload = async () => {
		if (files.length === 0) {
			return;
		}

		const count = files.length;

		// Reported in the click, so a close or navigation right after it already asks.
		onPendingChange?.(true);
		const outcome = intake(files).finally(() => onPendingChange?.(false));
		toast.promise(outcome, {
			loading: m.assets_upload_toast_loading({
				count,
			}),
			success: ({ failures }) => ({
				message:
					failures.length === 0
						? m.assets_upload_toast_success({
								count,
							})
						: m.assets_upload_toast_error({
								count: failures.length,
							}),
				description: describeUploadFailures(failures),
			}),
			error: (error) => ({
				message: m.assets_upload_toast_error({
					count,
				}),
				description: reasonMessageOf(error),
			}),
		});
		await outcome.then(onCreated, () => undefined);
	};

	const picker = (
		<>
			<FileUploader
				value={files}
				onValueChange={setFiles}
				progresses={progresses}
				maxFileCount={maxFileCount}
				maxSize={64 * 1024 * 1024}
				multiple
				accept={{
					...ASSET_UPLOAD_ACCEPT,
				}}
				disabled={isPending}
			/>
			<div className="mt-4 flex justify-end">
				<Button
					type="button"
					onClick={() => {
						void handleUpload();
					}}
					loading={isPending}
					disabled={files.length === 0}
				>
					{uploadLabel ?? m.assets_upload_submit_button()}
				</Button>
			</div>
		</>
	);

	return (
		<div className={variant === "compact" ? "space-y-4" : "space-y-6"}>
			{variant === "compact" ? (
				picker
			) : (
				<Card>
					<CardHeader>
						<CardTitle>{title ?? m.assets_upload_title()}</CardTitle>
						<CardDescription>
							{description ?? m.assets_upload_description()}
						</CardDescription>
					</CardHeader>
					<CardContent>{picker}</CardContent>
				</Card>
			)}

			{control.isPending || control.isSettled ? (
				<UploadProgress
					control={control}
					onReset={() => {
						setFiles([]);
						reset();
					}}
				/>
			) : null}
		</div>
	);
};

export { UploadComponent, type UploadVariant };
