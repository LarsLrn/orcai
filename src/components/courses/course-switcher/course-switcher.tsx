import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookMarkedIcon, Check, ChevronsUpDown } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
/* import { setActiveCourse } from "@/db/actions/course"; */
import type { Course } from "@/db/schema/course";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/orpc";

/* import { withToastPromise } from "@/lib/utils"; */

const CourseSwitcher = () => {
	const _navigate = useNavigate();
	const _queryClient = useQueryClient();
	const { data: sessionData, refetch } = authClient.useSession();

	const { data, status } = useQuery(
		orpc.course.list.queryOptions({
			input: { limit: 100, offset: 0 },
			queryKey: orpc.course.list.key(),
			placeholderData: keepPreviousData,
		}),
	);

	const { setOpenMobile } = useSidebar();

	const handleCourseChange = async (_course: Course) => {
		/* toast.promise(withToastPromise(setActiveCourse({ courseId: course.id })), {
			loading: `Changing course to ${course.title}`,
			success: async () => {
				refetch();

				await queryClient.invalidateQueries();

				setOpenMobile(false);
				navigate({ to: "/app", replace: true });

				return `Course changed to ${course.title}`;
			},
			error: (error) => ({
				message: "Failed to change course",
				description: error.message,
			}),
		}); */
	};

	if (status === "pending") {
		return <div>Loading...</div>;
	}
	if (!data?.data) {
		return <div>No courses available</div>;
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							closeSidebar={false}
							className="border bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground dark:bg-background/50"
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<BookMarkedIcon className="size-4" />
							</div>
							<div className="flex flex-col gap-0.5 leading-none">
								{!sessionData?.session.activeCourseId ? (
									<span>Select a course</span>
								) : (
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="font-semibold">Course</span>
										<span className="truncate text-xs">
											{data.data.find(
												(c) => c.id === sessionData.session.activeCourseId,
											)?.title || "Unknown Course"}
										</span>
									</div>
								)}
							</div>
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width]"
						align="start"
					>
						{data.data.map((course) => (
							<DropdownMenuItem
								key={course.id}
								onSelect={() => handleCourseChange(course)}
							>
								{course.title}
								{sessionData?.session.activeCourseId === course.id && (
									<Check className="ml-auto" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
};

export { CourseSwitcher };
