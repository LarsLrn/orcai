import { AlertCircle, CheckCircle, FileText, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { UploadHookControl } from "@/lib/s3/types/public";
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
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								Uploading Files
							</>
						) : isError ? (
							<>
								<AlertCircle className="h-4 w-4 text-destructive" />
								Upload Failed
							</>
						) : allSucceeded ? (
							<>
								<CheckCircle className="h-4 w-4 text-green-600" />
								Upload Complete
							</>
						) : (
							<>
								<AlertCircle className="h-4 w-4 text-yellow-600" />
								Upload Completed with Issues
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
						<Badge
							variant="secondary"
							className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
						>
							{completedFiles} successful
						</Badge>
					)}
					{failedFileCount > 0 && (
						<Badge
							variant="destructive"
							className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
						>
							{failedFileCount} failed
						</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{/* Critical Error Display */}
				{isError && error && (
					<div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
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
									"flex items-center gap-3 rounded-lg border p-3 transition-colors",
									isComplete &&
										"border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10",
									isFailed &&
										"border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10",
									(isUploading || isPending) &&
										"border-border/50 bg-background/50",
								)}
							>
								{/* File Icon */}
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-md",
										isComplete &&
											"bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
										isFailed &&
											"bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
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
										<p className="mt-1 text-red-600 text-xs dark:text-red-400">
											{fileInfo.error.message}
										</p>
									)}

									{/* Success Message */}
									{isComplete && (
										<p className="mt-1 text-green-600 text-xs dark:text-green-400">
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
								Retry Failed
							</Button>
						)} */}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
