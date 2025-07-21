import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(bots)/bots/")({
	component: RouteComponent,
	loader: async ({ context: { queryClient } }) => {
		// Preload blocks data for the form
		await queryClient.ensureQueryData(
			orpc.bot.list.queryOptions({
				input: { pageIndex: 0, pageSize: 50 },
				queryKey: orpc.bot.list.key({
					input: { pageIndex: 0, pageSize: 50 },
				}),
			}),
		);
	},
});

function RouteComponent() {
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: { pageIndex: 0, pageSize: 50 },
			queryKey: orpc.bot.list.key({
				input: { pageIndex: 0, pageSize: 50 },
			}),
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Bots
				</h4>

				<div className="flex gap-2">
					<Link
						to={"/app/bots/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Bot
					</Link>
				</div>
			</div>
			<div>
				{bots.data.map((bot) => (
					<Card key={bot.id}>
						<CardTitle>{bot.name}</CardTitle>
						<CardContent>
							<p>{bot.description}</p>
						</CardContent>
						<CardFooter>
							<Link to="/app/bots/$botId" params={{ botId: bot.id }}>
								View Bot
							</Link>
							<Link to="/app/bots/$botId/edit" params={{ botId: bot.id }}>
								Edit Bot
							</Link>
						</CardFooter>
					</Card>
				))}
			</div>
		</div>
	);
}
