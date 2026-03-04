import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BlockCard } from "@/components/blocks/block-card";
import { BotCard } from "@/components/bot/bot-card";
import { CourseCard } from "@/components/courses/course-card";
import { AssetCard } from "@/components/documents/asset-card";
import { buttonVariants } from "@/components/ui/button";
import { PageContent } from "@/components/ui/shell/page";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { orpc } from "@/lib/orpc/orpc";

const HUB_OVERVIEW_INPUT = { pageIndex: 0, pageSize: 6 } as const;

export const Route = createFileRoute("/app/hub/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
			),
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
			),
			queryClient.ensureQueryData(
				orpc.asset.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
			),
			queryClient.ensureQueryData(
				orpc.course.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
	);
	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
	);
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
	);
	const { data: courses } = useSuspenseQuery(
		orpc.course.list.queryOptions({ input: HUB_OVERVIEW_INPUT }),
	);

	return (
		<PageContent className="space-y-10">
			<Section>
				<SectionHeader>
					<SectionTitle>Bots</SectionTitle>
					<SectionDescription>
						AI assistants for your workspace.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/bots"
							className={buttonVariants({ variant: "outline" })}
						>
							View all
						</Link>
					</SectionAction>
				</SectionHeader>

				<SectionContent>
					<SectionGrid layout="3">
						{bots.data.map((bot) => (
							<BotCard key={bot.id} bot={bot} />
						))}
					</SectionGrid>
				</SectionContent>
			</Section>

			<Section>
				<SectionHeader>
					<SectionTitle>Blocks</SectionTitle>
					<SectionDescription>
						Reusable building blocks powering your bots.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/blocks"
							className={buttonVariants({ variant: "outline" })}
						>
							View all
						</Link>
					</SectionAction>
				</SectionHeader>

				<SectionContent>
					<SectionGrid layout="3">
						{blocks.data.map((block) => (
							<BlockCard key={block.id} block={block} />
						))}
					</SectionGrid>
				</SectionContent>
			</Section>

			<Section>
				<SectionHeader>
					<SectionTitle>Assets</SectionTitle>
					<SectionDescription>
						Reusable assets to build RAG (Retrieval-Augmented Generation)
						systems.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/assets"
							className={buttonVariants({ variant: "outline" })}
						>
							View all
						</Link>
					</SectionAction>
				</SectionHeader>

				<SectionContent>
					<SectionGrid layout="3">
						{assets.data.map((asset) => (
							<AssetCard key={asset.id} asset={asset} />
						))}
					</SectionGrid>
				</SectionContent>
			</Section>

			<Section>
				<SectionHeader>
					<SectionTitle>Courses</SectionTitle>
					<SectionDescription>
						Courses grouping your bots for structured learning.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/courses"
							className={buttonVariants({ variant: "outline" })}
						>
							View all
						</Link>
					</SectionAction>
				</SectionHeader>

				<SectionContent>
					<SectionGrid layout="3">
						{courses.data.map((course) => (
							<CourseCard key={course.id} course={course} />
						))}
					</SectionGrid>
				</SectionContent>
			</Section>
		</PageContent>
	);
}
