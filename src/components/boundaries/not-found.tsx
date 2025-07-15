import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// biome-ignore lint/suspicious/noExplicitAny: <Okay here as it is a fallback>
export function NotFound({ children }: { children?: any }) {
	const router = useRouter();

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<div className="w-full max-w-md space-y-6 text-center">
				<Card>
					<CardContent className="space-y-6 p-8">
						{/* Error Icon */}
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<AlertCircle className="h-8 w-8 text-muted-foreground" />
						</div>

						{/* Error Code */}
						<div className="space-y-2">
							<h1 className="font-bold text-4xl text-foreground">404</h1>
							<h2 className="font-semibold text-lg text-muted-foreground">
								Page Not Found
							</h2>
						</div>

						{/* Error Message */}
						<div className="text-muted-foreground">
							{children || (
								<p>
									The page you're looking for doesn't exist or has been moved.
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Action Buttons */}
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					<Button
						onClick={() => router.history.back()}
						variant="outline"
						className="flex items-center gap-2"
					>
						<ArrowLeft className="h-4 w-4" />
						Go Back
					</Button>
					<Button asChild className="flex items-center gap-2">
						<Link to="/app">
							<Home className="h-4 w-4" />
							Return Home
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
