import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod/v4";
import { columns } from "@/components/courses/table/columns";
import { CoursesDataTableSelectActions } from "@/components/courses/table/courses-data-table-select-actions";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { orpc } from "@/lib/orpc/orpc";

const searchParams = z.object({
	pageIndex: z.coerce.number().default(0),
	pageSize: z.coerce.number().default(1),
});

export const Route = createFileRoute("/app/courses/")({
	validateSearch: zodValidator(searchParams),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.ensureQueryData(
			orpc.course.list.queryOptions({
				input: { pageIndex, pageSize },
				queryKey: orpc.course.list.key({ input: { pageIndex, pageSize } }),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: courses } = useSuspenseQuery(
		orpc.course.list.queryOptions({
			input: { pageIndex, pageSize },
			queryKey: orpc.course.list.key({ input: { pageIndex, pageSize } }),
			placeholderData: keepPreviousData,
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Courses
				</h4>

				<div className="flex gap-2">
					<Link
						to={"/app/courses/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Course
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={courses.data}
					columns={columns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: courses.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						<CoursesDataTableSelectActions />
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</div>
		</div>
	);
}
