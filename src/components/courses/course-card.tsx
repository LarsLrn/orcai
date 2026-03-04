import { EditIcon, EyeIcon } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ResourceCard,
	ResourceCardAction as ResourceCardActionButton,
	type ResourceCardActionItem,
	ResourceCardBody,
	ResourceCardContent,
	ResourceCardDescription,
	ResourceCardFooter,
	ResourceCardHeader,
	ResourceCardMenu,
	ResourceCardMenuTrigger,
	ResourceCardMeta,
	type ResourceCardMetaItem,
	type ResourceCardPrimaryAction,
	ResourceCardTitle,
} from "@/components/ui/shell/resource-card";
import type { Course } from "@/lib/orpc/schemas/course";

const CourseCard = ({
	course,
	actions,
}: {
	course: Course;
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
}) => {
	const meta: ResourceCardMetaItem[] = [];
	if (course.createdAt) {
		meta.push({
			label: "Created",
			value: new Date(course.createdAt).toLocaleDateString(),
		});
	}

	const footerActions: ResourceCardActionItem[] = actions?.footer ?? [
		{
			key: "view",
			label: "View",
			icon: EyeIcon,
			linkProps: {
				to: "/app/hub/courses/$courseId",
				params: {
					courseId: course.id,
				},
			},
		},
		{
			key: "edit",
			label: "Edit",
			icon: EditIcon,
			variant: "default",
			linkProps: {
				to: "/app/hub/courses/$courseId/edit",
				params: {
					courseId: course.id,
				},
			},
		},
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const primaryAction = actions?.primary ?? {
		linkProps: {
			to: "/app/hub/courses/$courseId",
			params: {
				courseId: course.id,
			},
		},
	};

	return (
		<ResourceCard>
			{dropdownActions.length > 0 ? (
				<ResourceCardMenu>
					<DropdownMenu>
						<DropdownMenuTrigger render={<ResourceCardMenuTrigger />} />
						<DropdownMenuContent align="end" className="w-40">
							{dropdownActions.map((action) => (
								<DropdownMenuItem
									key={action.key}
									onClick={() => {
										if (action.onClick) {
											action.onClick();
										}
									}}
								>
									{action.icon ? (
										<action.icon className="mr-2 h-4 w-4" />
									) : null}
									{action.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</ResourceCardMenu>
			) : null}

			<ResourceCardBody action={primaryAction}>
				<ResourceCardHeader>
					<ResourceCardTitle>{course.title}</ResourceCardTitle>
					{course.description ? (
						<ResourceCardDescription>
							{course.description}
						</ResourceCardDescription>
					) : null}
				</ResourceCardHeader>
				<ResourceCardContent>
					<ResourceCardMeta meta={meta} />
				</ResourceCardContent>
			</ResourceCardBody>

			{footerActions.length > 0 ? (
				<ResourceCardFooter>
					{footerActions.map((action) => (
						<ResourceCardActionButton key={action.key} action={action} />
					))}
				</ResourceCardFooter>
			) : null}
		</ResourceCard>
	);
};

export { CourseCard };
