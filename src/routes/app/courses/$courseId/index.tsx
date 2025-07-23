import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BotIcon, CalendarIcon } from "lucide-react";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { courseQueryOptions } from "@/lib/query-options/course";

export const Route = createFileRoute("/app/courses/$courseId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		courseQueryOptions.find({
			input: { id: courseId },
		}),
	);

	const { id, title, contentHtml, config, createdAt } = course.data;

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex w-full flex-wrap justify-between gap-4">
					<h4 className="w-fit font-regular text-3xl tracking-tighter md:text-5xl">
						{title}
					</h4>
					<div className="flex gap-2">
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
					</div>
				</div>
			</div>

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
		</div>
	);
}
