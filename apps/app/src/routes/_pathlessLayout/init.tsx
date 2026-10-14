import { createFileRoute, redirect } from "@tanstack/react-router";
import { InitForm } from "@/components/auth/init/init-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/init")({
	loader: async ({ context: { queryClient } }) => {
		const status = await queryClient.query(
			orpc.bootstrap.status.queryOptions({
				input: {},
				staleTime: "static",
			}),
		);

		if (status.data.initialized) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{m.auth_init_page_title()}</CardTitle>
				<CardDescription>{m.auth_init_page_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<InitForm />
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				{m.auth_init_page_footer()}
			</CardFooter>
		</Card>
	);
}
