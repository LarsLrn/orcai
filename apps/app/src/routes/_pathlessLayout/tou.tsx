import { createFileRoute } from "@tanstack/react-router";
import { Markdown } from "@/components/app/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { m } from "@/paraglide/messages";
import markdownContent from "@/static/legal/terms-of-use.md?raw";

export const Route = createFileRoute("/_pathlessLayout/tou")({
	head: () => ({
		meta: [
			{
				title: m.account_legal_terms_link(),
			},
		],
	}),
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
