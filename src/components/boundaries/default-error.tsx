import type { ErrorComponentProps } from "@tanstack/react-router";
import {
	ErrorComponent,
	Link,
	rootRouteId,
	useMatch,
	useRouter,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DefaultErrorBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	// TODO: Log error to an error tracking service
	console.error(error);

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
							<h1 className="font-bold text-2xl text-foreground">
								{error.name}
							</h1>
							<h2 className="font-semibold text-lg text-muted-foreground">
								{error.message}
							</h2>
						</div>

						{/* Error Details */}
						<div className="text-muted-foreground text-sm">
							<p className="mb-4">
								We're sorry for the inconvenience. Please try again or go back
								to continue.
							</p>

							{/* Error Component (collapsible details) */}
							<details className="rounded-md bg-muted/50 p-3 text-left text-xs">
								<summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
									Technical Details
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
						Try Again
					</Button>
					{isRoot ? (
						<Button
							asChild
							variant="outline"
							className="flex items-center gap-2"
						>
							<Link to="/app">
								<Home className="h-4 w-4" />
								Return Home
							</Link>
						</Button>
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
							Go Back
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
