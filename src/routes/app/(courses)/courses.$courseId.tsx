import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BotIcon, CalendarIcon } from "lucide-react";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(courses)/courses/$courseId")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { courseId } }) => {
		await queryClient.ensureQueryData(
			orpc.course.find.queryOptions({
				input: { id: courseId },
				queryKey: orpc.course.find.key({ input: { id: courseId } }),
			}),
		);
	},
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
			queryKey: orpc.course.find.key({ input: { id: courseId } }),
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
					{/* {hasCourseEditPermission && ( */}
					<div className="flex gap-2">
						{/* <Link
              href={ROUTES.PRIVATE.courses.members.getPath({ id })}
              className={buttonVariants({ variant: "default" })}
            >
              Manage Users
            </Link> */}

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
					{/* )} */}
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
