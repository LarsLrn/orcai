import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/models/$modelId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { modelId } = Route.useParams();
	const { data: model } = useSuspenseQuery(
		orpc.model.find.queryOptions({
			input: { id: modelId },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					{model.data.name}
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/models/$modelId/edit"}
						params={{ modelId }}
						className={buttonVariants({ variant: "default" })}
					>
						Edit Model
					</Link>
				</div>
			</div>
			<div className="flex justify-center">
				<Card className="max-w-full lg:w-[60%]">
					<CardContent className="p-4">
						<div className="space-y-2">
							<p>
								<strong>Model:</strong> {model.data.name}
							</p>
							<p>
								<strong>Deprecated:</strong>{" "}
								{model.data.isDeprecated ? "Yes" : "No"}
							</p>
							<p>
								<strong>Created:</strong>{" "}
								{model.data.createdAt?.toLocaleDateString()}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
