import { CheckCircle, Database, FileText, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { UploadState } from "./use-file-upload";

interface UploadProgressProps {
	uploadState: UploadState;
	isUploading: boolean;
	onCancel?: () => void;
}

const stepConfig = {
	"getting-urls": {
		label: "Getting upload URLs",
		icon: FileText,
		color: "bg-blue-500",
	},
	uploading: {
		label: "Uploading files",
		icon: Upload,
		color: "bg-orange-500",
	},
	"saving-metadata": {
		label: "Saving metadata",
		icon: Database,
		color: "bg-purple-500",
	},
	completed: {
		label: "Upload completed",
		icon: CheckCircle,
		color: "bg-green-500",
	},
} as const;

export const UploadProgress = ({
	uploadState,
	isUploading,
	onCancel,
}: UploadProgressProps) => {
	if (!isUploading && uploadState.step === "idle") {
		return null;
	}

	const currentStep = stepConfig[uploadState.step as keyof typeof stepConfig];
	const fileProgressEntries = Object.entries(uploadState.fileProgress);

	return (
		<Card className="w-full">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						{currentStep && (
							<>
								<currentStep.icon className="h-5 w-5" />
								{currentStep.label}
							</>
						)}
					</CardTitle>
					<div className="flex items-center gap-2">
						<Badge
							variant={
								uploadState.step === "completed" ? "default" : "secondary"
							}
						>
							{Math.round(uploadState.progress)}%
						</Badge>
						{isUploading && onCancel && uploadState.step !== "completed" && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									if (
										confirm(
											"Are you sure you want to cancel the upload? This will stop all file uploads in progress.",
										)
									) {
										onCancel();
									}
								}}
								className="h-6 px-2 text-xs"
							>
								<X className="mr-1 h-3 w-3" />
								Cancel
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Overall Progress */}
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span>Overall Progress</span>
						<span>{Math.round(uploadState.progress)}%</span>
					</div>
					<Progress value={uploadState.progress} className="h-2" />
				</div>

				{/* Current File */}
				{uploadState.currentFile && uploadState.step === "uploading" && (
					<div className="text-muted-foreground text-sm">
						Currently uploading:{" "}
						<span className="font-medium">{uploadState.currentFile}</span>
					</div>
				)}

				{/* Individual File Progress */}
				{fileProgressEntries.length > 0 && (
					<div className="space-y-3">
						<h4 className="font-medium text-sm">File Progress</h4>
						<div className="max-h-32 space-y-2 overflow-y-auto">
							{fileProgressEntries.map(([fileName, progress]) => (
								<div key={fileName} className="space-y-1">
									<div className="flex justify-between text-xs">
										<span className="max-w-[200px] truncate" title={fileName}>
											{fileName}
										</span>
										<span>{Math.round(progress)}%</span>
									</div>
									<Progress value={progress} className="h-1" />
								</div>
							))}
						</div>
					</div>
				)}

				{/* Upload Steps Indicator */}
				<div className="flex items-center gap-2 pt-2">
					{Object.entries(stepConfig).map(([step, config], index) => {
						const stepKey = step as keyof typeof stepConfig;
						const currentStep = uploadState.step;

						let isCompleted = false;
						if (currentStep === "completed") {
							isCompleted = true;
						} else if (
							stepKey === "getting-urls" &&
							["uploading", "saving-metadata"].includes(currentStep)
						) {
							isCompleted = true;
						} else if (
							stepKey === "uploading" &&
							currentStep === "saving-metadata"
						) {
							isCompleted = true;
						}

						const isCurrent = currentStep === stepKey;

						return (
							<div key={step} className="flex items-center gap-1">
								<div
									className={`h-2 w-2 rounded-full transition-colors ${
										isCompleted
											? "bg-green-500"
											: isCurrent
												? config.color
												: "bg-gray-300"
									}`}
								/>
								{index < Object.keys(stepConfig).length - 1 && (
									<div className="h-px w-8 bg-gray-300" />
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
};
