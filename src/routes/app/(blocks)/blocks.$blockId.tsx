import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(blocks)/blocks/$blockId")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await queryClient.ensureQueryData(
			orpc.block.find.queryOptions({
				input: { id: blockId },
				queryKey: orpc.block.find.key({ input: { id: blockId } }),
			}),
		);
	},
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: block } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: { id: blockId },
			queryKey: orpc.block.find.key({ input: { id: blockId } }),
		}),
	);

	const { id, name, createdAt } = block.data;

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex w-full flex-wrap justify-between gap-4">
					<h4 className="w-fit font-regular text-3xl tracking-tighter md:text-5xl">
						{name}
					</h4>
					<div className="flex gap-2">
						<Link
							to={"/app/courses/add"}
							className={buttonVariants({ variant: "default" })}
						>
							Add Resources
						</Link>
						<Link
							to={"/app/blocks/$blockId/edit"}
							params={{ blockId: id }}
							className={buttonVariants({ variant: "default" })}
						>
							Edit Block
						</Link>
					</div>
					{/* )} */}
				</div>
			</div>

			<div className="flex gap-2">
				<Badge>
					<CalendarIcon className="mr-1" />{" "}
					{format(createdAt ?? "", "MMM dd, yyyy")}
				</Badge>
			</div>
		</div>
	);
}
