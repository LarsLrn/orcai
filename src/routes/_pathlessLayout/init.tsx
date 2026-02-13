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

export const Route = createFileRoute("/_pathlessLayout/init")({
	loader: async ({ context: { queryClient } }) => {
		const status = await queryClient.ensureQueryData(
			orpc.bootstrap.status.queryOptions({ input: {} }),
		);

		if (status.data.initialized) {
			throw redirect({ to: "/login", statusCode: 302 });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Initialize Instance</CardTitle>
				<CardDescription>
					Set up the first organisation and owner account for this deployment.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<InitForm />
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				This page is only available until the instance is initialized.
			</CardFooter>
		</Card>
	);
}
