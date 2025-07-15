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

	console.error(error);

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<div className="text-center space-y-6 max-w-lg w-full">
				<Card>
					<CardContent className="p-8 space-y-6">
						{/* Error Icon */}
						<div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
							<AlertTriangle className="w-8 h-8 text-destructive" />
						</div>

						{/* Error Title */}
						<div className="space-y-2">
							<h1 className="text-2xl font-bold text-foreground">
								Something went wrong
							</h1>
							<h2 className="text-lg font-semibold text-muted-foreground">
								An unexpected error occurred
							</h2>
						</div>

						{/* Error Details */}
						<div className="text-muted-foreground text-sm">
							<p className="mb-4">
								We're sorry for the inconvenience. Please try again or go back
								to continue.
							</p>

							{/* Error Component (collapsible details) */}
							<details className="text-left bg-muted/50 rounded-md p-3 text-xs">
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
				<div className="flex justify-center flex-col sm:flex-row gap-3">
					<Button
						onClick={() => {
							router.invalidate();
						}}
						className="flex items-center gap-2"
					>
						<RefreshCw className="w-4 h-4" />
						Try Again
					</Button>
					{isRoot ? (
						<Button
							asChild
							variant="outline"
							className="flex items-center gap-2"
						>
							<Link to="/app">
								<Home className="w-4 h-4" />
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
							<ArrowLeft className="w-4 h-4" />
							Go Back
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
