import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { eq, getTableColumns } from "drizzle-orm";
import { CalendarXIcon } from "lucide-react";
import z from "zod/v4";
import { SignUpForm } from "@/components/auth/signup-form";
import { SimplePlaceholder } from "@/components/placeholders/simple-placeholder";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/drizzle";
import {
	type CourseInvitation,
	courseInvitation,
} from "@/db/schema/course-invitation";

const getCourseInvitationById = createServerFn({
	method: "GET",
	response: "data",
})
	.validator(
		z.object({
			id: z.uuidv4(),
		}),
	)
	.handler(async (ctx): Promise<{ query: CourseInvitation | undefined }> => {
		try {
			const [query] = await db
				.select({ ...getTableColumns(courseInvitation) })
				.from(courseInvitation)
				.where(eq(courseInvitation.id, ctx.data.id))
				.limit(1);

			return { query };
		} catch (error) {
			console.error("Error parsing UUID:", error);
			return { query: undefined };
		}
	});

export const Route = createFileRoute("/_pathlessLayout/register")({
	component: RouteComponent,
	validateSearch: zodValidator(
		z.object({
			inv: z.string().optional(),
		}),
	),
	loaderDeps: ({ search }) => ({
		inv: search.inv,
	}),
	loader: ({ deps }) => {
		if (!deps.inv) {
			return { query: undefined };
		}
		return getCourseInvitationById({ data: { id: deps.inv } });
	},
});

const RegistrationDisabled = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<SimplePlaceholder className={className} {...props}>
			Registration is currently restricted. If you have been invited, please
			check your invitation link.
		</SimplePlaceholder>
	);
};

const InvitationExpired = () => {
	return (
		<SimplePlaceholder Icon={CalendarXIcon}>
			Your invitation has expired. Please contact the administrator for a new
			invitation.
		</SimplePlaceholder>
	);
};

function RouteComponent() {
	const { query } = Route.useLoaderData();

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Sign Up</CardTitle>
				<CardDescription>Create a new account to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				{/* {query ? (
					<div>
						{query.expiresAt < new Date() ? (
							<InvitationExpired />
						) : (
							<SignUpForm invitation={query} />
						)}
					</div>
				) : (
					<RegistrationDisabled />
				)} */}
				<SignUpForm invitation={query} />
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				<Link to={"/login"}>Already have an account?</Link>
			</CardFooter>
		</Card>
	);
}
