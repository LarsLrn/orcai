import type { BotListItem, CatalogueEntry } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CompassIcon, StarIcon } from "lucide-react";
import {
	Tile,
	TileBody,
	TileDescription,
	TileIcon,
	TileTitle,
} from "@/components/ui/shell/tile";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { orpc } from "@/lib/orpc/orpc";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";
import { HomeSection } from "./home-section";

/** A bot starts a chat, so only bots the user may chat with here, favourites first. */
export const tryBotsInput = {
	pageIndex: 0,
	pageSize: 3,
	sort: "favouritesFirst",
	filters: {
		usable: true,
	},
} as const;

/** The newest catalogue entry the active organisation has not added yet. */
export const catalogueTeaserInput = {
	pageIndex: 0,
	pageSize: 1,
	hideAdded: true,
} as const;

const { Icon: BotGlyph, well: botWell } = RESOURCE_KINDS.bot;

const newChatLink = (bot: BotListItem) =>
	({
		to: "/app/chat/new",
		search: {
			botId: bot.id,
		},
	}) as const;

const FeaturedBot = ({ bot }: { bot: BotListItem }) => (
	<article className="group/feat relative flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl border bg-linear-to-br from-kind-bot/30 via-kind-bot/10 to-accent-brand/25 p-6 shadow-xs transition hover:shadow-xl has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/75 sm:row-span-2">
		<BotGlyph
			aria-hidden="true"
			className="absolute -top-6 -right-6 size-48 text-foreground/[0.06] transition-transform motion-safe:group-hover/feat:scale-110"
		/>
		{bot.isFavourite ? (
			<p className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
				<StarIcon
					aria-hidden="true"
					className="size-3.5 fill-amber-400 text-amber-400"
				/>
				{m.home_try_favourite_label()}
			</p>
		) : null}
		<h3 className="line-clamp-2 break-words font-heading font-semibold text-2xl tracking-tight">
			<Link
				{...newChatLink(bot)}
				className="outline-none after:absolute after:inset-0"
			>
				{bot.name}
			</Link>
		</h3>
		{bot.description ? (
			<p className="mt-2 line-clamp-3 max-w-md break-words text-foreground/75">
				{bot.description}
			</p>
		) : null}
		<span className="mt-4 flex items-center gap-1.5 font-medium text-sm">
			{m.chat_start_action()}
			<ArrowRightIcon
				aria-hidden="true"
				className="size-4 transition-transform motion-safe:group-hover/feat:translate-x-1"
			/>
		</span>
	</article>
);

const BotTile = ({ bot }: { bot: BotListItem }) => (
	<Tile>
		<TileIcon className={botWell}>
			<BotGlyph />
		</TileIcon>
		<TileBody>
			<TileTitle
				action={{
					linkProps: newChatLink(bot),
				}}
			>
				{bot.name}
			</TileTitle>
			<TileDescription>{bot.description}</TileDescription>
		</TileBody>
	</Tile>
);

const CatalogueTeaser = ({ entry }: { entry: CatalogueEntry }) => (
	<Link
		to={cataloguePaths(entry.kind).detail}
		params={{
			id: entry.id,
		}}
		className="flex items-center gap-4 rounded-3xl border border-dashed p-4 outline-none hover:border-foreground/25 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/75"
	>
		<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-brand/15 text-accent-brand">
			<CompassIcon aria-hidden="true" className="size-5" />
		</span>
		<span className="min-w-0 flex-1">
			<span className="line-clamp-2 break-words font-medium text-sm">
				{m.home_try_catalogue_new({
					name: entry.name,
				})}
			</span>
			<span className="block truncate text-muted-foreground text-xs">
				{entry.description ? `${entry.description} ` : null}
				{m.catalogue_from_organisation({
					organisation: entry.homeOrganization.name,
				})}
			</span>
		</span>
		<ArrowRightIcon
			aria-hidden="true"
			className="size-4 shrink-0 text-muted-foreground"
		/>
	</Link>
);

/** Bots to start a chat with, the favourite first, and one new catalogue entry. */
const TrySomething = () => {
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: tryBotsInput,
		}),
	);
	const { data: catalogue } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: catalogueTeaserInput,
		}),
	);
	const [featured, ...rest] = bots.data;
	const teaser = catalogue.data[0];

	return (
		<HomeSection
			title={m.home_try_title()}
			linkLabel={m.home_try_all_bots_action()}
			linkProps={{
				to: "/app/library/bots",
			}}
		>
			{featured ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<FeaturedBot bot={featured} />
					{rest.map((bot) => (
						<BotTile key={bot.id} bot={bot} />
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{m.home_try_empty()}</p>
			)}
			{teaser ? <CatalogueTeaser entry={teaser} /> : null}
		</HomeSection>
	);
};

export { TrySomething };
