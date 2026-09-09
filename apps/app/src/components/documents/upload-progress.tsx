import type { UploadHookControl } from "@orcai/s3/client";
import { AlertCircle, CheckCircle, FileText, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = [
		"B",
		"KB",
		"MB",
		"GB",
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const UploadProgress = ({
	control,
	onReset = () => void 0,
}: {
	control: UploadHookControl<true>;
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
		<Card className="w-full border-border/50 bg-card/50 backdrop-blur-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin text-status-processing" />
								Uploading files
							</>
						) : isError ? (
							<>
								<AlertCircle className="h-4 w-4 text-destructive" />
								Upload failed
							</>
						) : allSucceeded ? (
							<>
								<CheckCircle className="h-4 w-4 text-status-success" />
								Upload complete
							</>
						) : (
							<>
								<AlertCircle className="h-4 w-4 text-status-warning" />
								Upload completed with Issues
							</>
						)}
					</CardTitle>
					{isSettled && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleReset}
							className="h-8 w-8 p-0"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Overall Progress */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							{completedFiles} of {totalFiles} files completed
						</span>
						<span className="font-medium">
							{Math.round(averageProgress * 100)}%
						</span>
					</div>
					<Progress value={averageProgress * 100} className="h-2" />
				</div>

				{/* Status Summary */}
				<div className="flex items-center gap-2 pt-1">
					{completedFiles > 0 && (
						<Badge variant="success">{completedFiles} successful</Badge>
					)}
					{failedFileCount > 0 && (
						<Badge variant="danger">{failedFileCount} failed</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{/* Critical Error Display */}
				{isError && error && (
					<div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
						<div className="flex items-center gap-2 text-destructive text-sm">
							<AlertCircle className="h-4 w-4" />
							<span className="font-medium">Error:</span>
							<span>{error.message}</span>
						</div>
					</div>
				)}

				{/* Individual File Progress */}
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
								{/* File Icon */}
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

								{/* File Info */}
								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center justify-between">
										<p className="truncate font-medium text-sm">
											{fileInfo.name}
										</p>
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<span>{formatFileSize(fileInfo.size)}</span>
											{(isUploading || isPending) && (
												<span>{Math.round(fileInfo.progress * 100)}%</span>
											)}
										</div>
									</div>

									{/* Progress Bar for Individual Files */}
									{(isUploading || isPending) && (
										<Progress
											value={fileInfo.progress * 100}
											className="h-1.5"
										/>
									)}

									{/* Error Message */}
									{isFailed && "error" in fileInfo && (
										<p className="mt-1 text-status-danger text-xs">
											{fileInfo.error.message}
										</p>
									)}

									{/* Success Message */}
									{isComplete && (
										<p className="mt-1 text-status-success text-xs">
											Upload completed successfully
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Action Buttons */}
				{isSettled && (
					<div className="mt-4 flex justify-end gap-2 border-border/50 border-t pt-3">
						<Button variant="outline" size="sm" onClick={handleReset}>
							Clear
						</Button>
						{/* {hasFailedFiles && (
							<Button
								variant="default"
								size="sm"
								onClick={() => {
									// Note: This would need to be implemented to retry failed files
									// control.retryFailedFiles?.();
								}}
								disabled
							>
								Retry failed
							</Button>
						)} */}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
