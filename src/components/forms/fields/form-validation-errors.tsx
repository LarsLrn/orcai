import { AlertTriangle } from "lucide-react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FormValidationErrorsProps<
	TFieldValues extends FieldValues = FieldValues,
> {
	form: UseFormReturn<TFieldValues>;
	title?: string;
	className?: string;
}

/**
 * A reusable component that displays all form validation errors in a clear, organized way.
 * Automatically extracts and formats errors from react-hook-form validation state.
 */
const FormValidationErrors = <TFieldValues extends FieldValues = FieldValues>({
	form,
	title = "Please fix the following errors:",
	className,
}: FormValidationErrorsProps<TFieldValues>) => {
	// Watch form state to ensure re-renders on changes
	const formState = form.formState;
	const errors = formState.errors;
	const hasErrors = Object.keys(errors).length > 0;

	if (!hasErrors) {
		return null;
	}

	// Helper to process a single error entry
	const processErrorEntry = (
		key: string,
		value: any,
		prefix: string,
	): Array<{ field: string; message: string }> => {
		if (!value || typeof value !== "object") return [];

		const fieldPath = prefix ? `${prefix}.${key}` : key;
		const errorValue = value as Record<string, any>;

		if (typeof errorValue.message === "string") {
			return [{ field: fieldPath, message: errorValue.message }];
		}

		if (errorValue.type === "required") {
			return [{ field: fieldPath, message: "This field is required" }];
		}

		return extractErrors(errorValue, fieldPath);
	};

	// Extract error messages from nested objects
	const extractErrors = (
		errorObj: any,
		prefix = "",
	): Array<{ field: string; message: string }> => {
		const errorList: Array<{ field: string; message: string }> = [];

		for (const [key, value] of Object.entries(errorObj)) {
			errorList.push(...processErrorEntry(key, value, prefix));
		}

		return errorList;
	};

	const allErrors = extractErrors(errors);

	// Format field names for better readability
	const formatFieldName = (fieldPath: string): string => {
		return fieldPath
			.split(".")
			.map((part) => {
				const cleanPart = part.replace(/\[\d+\]/g, "");
				return cleanPart
					.replace(/([A-Z])/g, " $1")
					.replace(/^./, (str) => str.toUpperCase())
					.trim();
			})
			.join(" → ");
	};

	return (
		<Alert variant="destructive" className={className}>
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				<ul className="mt-2 space-y-1">
					{allErrors.map((error, index) => (
						<li
							key={`${error.field}-${index}`}
							className="flex items-start gap-2"
						>
							<span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-current" />
							<div>
								<span className="font-medium">
									{formatFieldName(error.field)}:
								</span>{" "}
								<span>{error.message}</span>
							</div>
						</li>
					))}
				</ul>
				{allErrors.length > 1 && (
					<p className="mt-2 text-xs opacity-75">
						Please correct {allErrors.length} error
						{allErrors.length === 1 ? "" : "s"} above.
					</p>
				)}
			</AlertDescription>
		</Alert>
	);
};

export { FormValidationErrors };
