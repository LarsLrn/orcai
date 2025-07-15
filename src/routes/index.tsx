import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db } from "@/db/drizzle";
import { course } from "@/db/schema/course";

const getCount = createServerFn({
	method: "GET",
}).handler(async () => {
	const courses = await db
		.select({ id: course.id, title: course.title })
		.from(course);
	return courses;
});

export const Route = createFileRoute("/")({
	component: Home,
	loader: async () => await getCount(),
});

function Home() {
	const state = Route.useLoaderData();

	return (
		<div>
			{state.map((course) => (
				<div key={course.id}>{course.title}</div>
			))}
			<Button onClick={() => toast.success("Button clicked!")}>Test</Button>
			<Button onClick={() => console.log("Button clicked")}>Test</Button>
		</div>
	);
}
