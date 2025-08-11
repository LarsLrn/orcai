import fs from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Markdown } from "@/components/app/markdown";
import { Card, CardContent } from "@/components/ui/card";

const getMarkdownContent = createServerFn({ method: "GET" }).handler(() => {
	const markdownPath = path.join(process.cwd(), "src/md/privacy-policy.md");
	const markdownContent = fs.readFileSync(markdownPath, "utf8");

	return markdownContent;
});

export const Route = createFileRoute("/_pathlessLayout/privacy")({
	component: RouteComponent,
	loader: async () => {
		const content = await getMarkdownContent();
		return { content };
	},
	ssr: "data-only",
});

function RouteComponent() {
	const { content: markdownContent } = Route.useLoaderData();

	return (
		<Card className="container mx-auto py-8">
			<CardContent className="mx-auto max-w-4xl">
				<Markdown>{markdownContent}</Markdown>
			</CardContent>
		</Card>
	);
}
