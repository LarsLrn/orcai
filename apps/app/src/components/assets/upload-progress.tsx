import type { UploadHookControl } from "@orcai/s3/client";
import { AlertCircle, CheckCircle, FileText, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/locale/format-file-size";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const formatProgress = (value: number) =>
	new Intl.NumberFormat(getLocale(), {
		style: "percent",
		maximumFractionDigits: 0,
	}).format(value);

export const UploadProgress = ({
	control,
	onReset = () => void 0,
}: {
	control: UploadHookControl;
	onReset?: () => void;
}) => {
	const {
		progresses,
		averageProgress,
		uploadedFiles,
		failedFiles,
		isPending,
		isSettled,
		allSucceeded,
		isError,
		error,
		reset,
	} = control;

	// Don't render if no files are being processed
	if (!isPending && !isSettled) {
		return null;
	}

	const totalFiles = progresses.length;
	const completedFiles = uploadedFiles.length;
	const failedFileCount = failedFiles.length;

	const handleReset = () => {
		reset();
		onReset();
	};

	return (
		<Card className="border-border/50 bg-card/50 w-full backdrop-blur-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						{isPending ? (
							<>
								<Loader2 className="text-status-processing h-4 w-4 animate-spin" />
								{m.assets_upload_progress_pending_title()}
							</>
						) : isError ? (
							<>
								<AlertCircle className="text-destructive h-4 w-4" />
								{m.assets_upload_progress_error_title()}
							</>
						) : allSucceeded ? (
							<>
								<CheckCircle className="text-status-success h-4 w-4" />
								{m.assets_upload_progress_success_title()}
							</>
						) : (
							<>
								<AlertCircle className="text-status-warning h-4 w-4" />
								{m.assets_upload_progress_partial_title()}
							</>
						)}
					</CardTitle>
					{isSettled && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleReset}
							aria-label={m.common_close_button()}
							className="h-8 w-8 p-0"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							{m.assets_upload_progress_completed_count({
								completed: completedFiles,
								count: totalFiles,
							})}
						</span>
						<span className="font-medium">
							{formatProgress(averageProgress)}
						</span>
					</div>
					<Progress value={averageProgress * 100} className="h-2" />
				</div>

				<div className="flex items-center gap-2 pt-1">
					{completedFiles > 0 && (
						<Badge variant="success">
							{m.assets_upload_progress_success_badge({
								count: completedFiles,
							})}
						</Badge>
					)}
					{failedFileCount > 0 && (
						<Badge variant="danger">
							{m.assets_upload_progress_failed_badge({
								count: failedFileCount,
							})}
						</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{isError && error && (
					<div className="border-destructive/20 bg-destructive/5 mb-4 rounded-2xl border p-3">
						<div className="text-destructive flex items-center gap-2 text-sm">
							<AlertCircle className="h-4 w-4" />
							<span className="font-medium">
								{m.assets_upload_progress_error_label()}
							</span>
							<span>{error.message}</span>
						</div>
					</div>
				)}

				<div className="max-h-60 space-y-3 overflow-y-auto">
					{progresses.map((fileInfo) => {
						const isComplete = fileInfo.status === "complete";
						const isFailed = fileInfo.status === "failed";
						const isUploading = fileInfo.status === "uploading";
						const isPending = fileInfo.status === "pending";

						return (
							<div
								key={fileInfo.objectKey}
								className={cn(
									"flex items-center gap-3 rounded-xl border p-3 transition-colors",
									isComplete &&
										"border-status-success/30 bg-status-success/8 dark:bg-status-success/12",
									isFailed &&
										"border-status-danger/30 bg-status-danger/8 dark:bg-status-danger/12",
									(isUploading || isPending) &&
										"border-border/50 bg-background/50",
								)}
							>
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-md",
										isComplete &&
											"bg-status-success/12 text-status-success dark:bg-status-success/20",
										isFailed &&
											"bg-status-danger/12 text-status-danger dark:bg-status-danger/20",
										(isUploading || isPending) &&
											"bg-muted text-muted-foreground",
									)}
								>
									{isComplete ? (
										<CheckCircle className="h-4 w-4" />
									) : isFailed ? (
										<X className="h-4 w-4" />
									) : isUploading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<FileText className="h-4 w-4" />
									)}
								</div>

								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center justify-between">
										<p className="truncate text-sm font-medium">
											{fileInfo.name}
										</p>
										<div className="text-muted-foreground flex items-center gap-2 text-xs">
											<span>{formatFileSize(fileInfo.size)}</span>
											{(isUploading || isPending) && (
												<span>{formatProgress(fileInfo.progress)}</span>
											)}
										</div>
									</div>

									{(isUploading || isPending) && (
										<Progress
											value={fileInfo.progress * 100}
											className="h-1.5"
										/>
									)}

									{isFailed && "error" in fileInfo && (
										<p className="text-status-danger mt-1 text-xs">
											{fileInfo.error.message}
										</p>
									)}

									{isComplete && (
										<p className="text-status-success mt-1 text-xs">
											{m.assets_upload_progress_file_success_label()}
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{isSettled && (
					<div className="border-border/50 mt-4 flex justify-end gap-2 border-t pt-3">
						<Button variant="outline" size="sm" onClick={handleReset}>
							{m.assets_upload_progress_clear_button()}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
