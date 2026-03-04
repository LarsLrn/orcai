import type { AnyFieldMeta } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-form";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormContext } from "@/hooks/form/context";

/**
 * A reusable component that displays all form validation errors.
 * Must be used within form.AppForm context (as a formComponent).
 */
const FormValidationErrors = ({
	title = "Please fix the following errors:",
	className,
}: {
	title?: string;
	className?: string;
}) => {
	const form = useFormContext();
	const fieldMeta = useStore(form.store, (state) => state.fieldMeta) as Record<
		string,
		AnyFieldMeta | undefined
	>;
	const formErrorMap = useStore(form.store, (state) => state.errorMap);

	// Collect all field errors
	const fieldErrors: Array<{
		field: string;
		message: string;
	}> = [];
	for (const [fieldName, meta] of Object.entries(fieldMeta)) {
		if (meta?.errors?.length) {
			for (const error of meta.errors) {
				if (typeof error === "string") {
					fieldErrors.push({
						field: fieldName,
						message: error,
					});
				} else if (error && typeof error === "object" && "message" in error) {
					fieldErrors.push({
						field: fieldName,
						message: String(error.message),
					});
				}
			}
		}
	}

	// Collect form-level errors
	const formErrors: string[] = [];
	for (const error of Object.values(formErrorMap)) {
		if (typeof error === "string") {
			formErrors.push(error);
		} else if (error && typeof error === "object" && "message" in error) {
			formErrors.push(String(error.message));
		}
	}

	const hasErrors = fieldErrors.length > 0 || formErrors.length > 0;

	if (!hasErrors) {
		return null;
	}

	const formatFieldName = (fieldPath: string): string => {
		return fieldPath
			.split(".")
			.map((part) =>
				part
					.replace(/([A-Z])/g, " $1")
					.replace(/^./, (str) => str.toUpperCase())
					.trim(),
			)
			.join(" → ");
	};

	const totalErrors = fieldErrors.length + formErrors.length;

	return (
		<Alert variant="destructive" className={className}>
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				<ul className="mt-2 space-y-1">
					{formErrors.map((error) => (
						<li key={error} className="flex items-start gap-2">
							<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
							<span>{error}</span>
						</li>
					))}
					{fieldErrors.map((error) => (
						<li
							key={`${error.field}-${error.message}`}
							className="flex items-start gap-2"
						>
							<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
							<div>
								<span className="font-medium">
									{formatFieldName(error.field)}:
								</span>{" "}
								<span>{error.message}</span>
							</div>
						</li>
					))}
				</ul>
				{totalErrors > 1 && (
					<p className="mt-2 text-xs opacity-75">
						Please correct {totalErrors} errors above.
					</p>
				)}
			</AlertDescription>
		</Alert>
	);
};
export default FormValidationErrors;
