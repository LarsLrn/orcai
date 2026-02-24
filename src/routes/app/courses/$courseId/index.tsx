import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BotIcon, CalendarIcon } from "lucide-react";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/courses/$courseId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
		}),
	);

	const { id, title, contentHtml, config, createdAt } = course.data;

	return (
		<Page>
			<PageHeader>
				<PageTitle>{title}</PageTitle>
				<PageAction>
					<Link
						to={"/app/courses/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Resources
					</Link>
					<Link
						to={"/app/courses/$courseId/edit"}
						params={{ courseId: id }}
						className={buttonVariants({ variant: "default" })}
					>
						Edit Course
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<div className="flex gap-2">
					<Badge>
						<BotIcon className="mr-1" /> {config.model}
					</Badge>
					<Badge>
						<CalendarIcon className="mr-1" />{" "}
						{format(createdAt ?? "", "MMM dd, yyyy")}
					</Badge>
				</div>

				<div className="flex justify-center">
					<ContentRenderer html={contentHtml} />
				</div>
			</PageContent>
		</Page>
	);
}
