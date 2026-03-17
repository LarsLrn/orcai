import { createFileRoute } from "@tanstack/react-router";
import { Markdown } from "@/components/app/markdown";
import { Card, CardContent } from "@/components/ui/card";
import markdownContent from "@/static/legal/privacy-policy.md?raw";

export const Route = createFileRoute("/_pathlessLayout/privacy")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Card className="container mx-auto py-8">
			<CardContent className="mx-auto max-w-4xl">
				<Markdown>{markdownContent}</Markdown>
			</CardContent>
		</Card>
	);
}
