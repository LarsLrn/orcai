import type { ErrorComponentProps } from "@tanstack/react-router";
import {
	ErrorComponent,
	Link,
	rootRouteId,
	useMatch,
	useRouter,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { describeError } from "@/lib/errors/describe-error";
import { m } from "@/paraglide/messages";

interface ValidationErrorData {
	data?: {
		fieldErrors?: Record<string, string[]>;
		formErrors?: string[];
	};
}

/** Validation payloads already carry sentences translated by the zod error map. */
function getValidationErrorMessages(error: Error): string[] {
	const { data } = error as Error & ValidationErrorData;

	if (!data?.fieldErrors) {
		return [];
	}

	return [
		...Object.values(data.fieldErrors).flat(),
		...(data.formErrors ?? []),
	];
}

export function DefaultErrorBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	// TODO: Log error to an error tracking service
	console.error(error);

	// Extract validation messages if available
	const validationMessages = getValidationErrorMessages(error);
	const hasValidationErrors = validationMessages.length > 0;

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<div className="w-full max-w-lg space-y-6 text-center">
				<Card>
					<CardContent className="space-y-6 p-8">
						{/* Error Icon */}
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-8 w-8 text-destructive" />
						</div>

						{/* Error Title */}
						<div className="space-y-2">
							<h1 className="font-semibold text-2xl text-foreground">
								{m.boundaries_default_error_title()}
							</h1>
							{hasValidationErrors ? (
								<div className="space-y-2 text-left">
									{validationMessages.map((msg) => (
										<div
											key={msg}
											className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
										>
											{msg}
										</div>
									))}
								</div>
							) : (
								<h2 className="font-semibold text-lg text-muted-foreground">
									{describeError(error)}
								</h2>
							)}
						</div>

						{/* Error Details */}
						<div className="text-muted-foreground text-sm">
							<p className="mb-4">{m.boundaries_default_error_description()}</p>

							{/* Error Component (collapsible details) */}
							<details className="rounded-md bg-muted/50 p-3 text-left text-xs">
								<summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
									{m.boundaries_default_error_details_summary()}
								</summary>
								<div className="mt-2 font-mono">
									<ErrorComponent error={error} />
								</div>
							</details>
						</div>
					</CardContent>
				</Card>

				{/* Action Buttons */}
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					<Button
						onClick={() => {
							router.invalidate();
						}}
						className="flex items-center gap-2"
					>
						<RefreshCw className="h-4 w-4" />
						{m.boundaries_default_error_retry_button()}
					</Button>
					{isRoot ? (
						<Link
							to="/app"
							className={buttonVariants({
								variant: "outline",
								className: "flex items-center gap-2",
							})}
						>
							<Home className="h-4 w-4" />
							{m.boundaries_default_error_home_link()}
						</Link>
					) : (
						<Button
							variant="outline"
							className="flex items-center gap-2"
							onClick={(e) => {
								e.preventDefault();
								window.history.back();
							}}
						>
							<ArrowLeft className="h-4 w-4" />
							{m.boundaries_default_error_back_button()}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
