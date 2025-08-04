import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DatabaseBlockForm } from "@/components/blocks/database-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block-form";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/blocks/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	const [type, setType] = useState<string | undefined>();

	return (
		<>
			<Select onValueChange={(value) => setType(value)}>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Select a fruit" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Type</SelectLabel>
						<SelectItem value="template">Template</SelectItem>
						<SelectItem value="database">Database</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
			{type === "template" && <TemplateBlockForm />}
			{type === "database" && <DatabaseBlockForm />}
		</>
	);
}
