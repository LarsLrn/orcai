import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BotIcon, CalendarIcon, GlobeIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/courses/$courseId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
		}),
	);
	const { data: visibility } = useSuspenseQuery(
		orpc.resource.getVisibility.queryOptions({
			input: { resourceType: "course", resourceId: courseId },
		}),
	);

	const { id, title, contentHtml, config, createdAt } = course.data;

	return (
		<Page>
			<PageHeader>
				<PageTitle>{title}</PageTitle>
				<PageAction>
					<Button variant="outline" onClick={() => setIsAccessOpen(true)}>
						<KeyRoundIcon className="mr-2 h-4 w-4" />
						Access
					</Button>
					<Link
						to={"/app/hub/courses/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Resources
					</Link>
					<Link
						to={"/app/hub/courses/$courseId/edit"}
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
					{visibility.data.visibility === "public" && (
						<Badge variant="default">
							<GlobeIcon className="mr-1 h-3 w-3" />
							Public
						</Badge>
					)}
					<Badge>
						<CalendarIcon className="mr-1" />{" "}
						{format(createdAt ?? "", "MMM dd, yyyy")}
					</Badge>
				</div>

				<div className="flex justify-center">
					<ContentRenderer html={contentHtml} />
				</div>

				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{ type: "course", id }}
					resourceName={title}
				/>
			</PageContent>
		</Page>
	);
}
