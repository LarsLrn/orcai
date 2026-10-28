import type { ChatMessageRating, OrganizationAnalytics } from "@orcai/schema";
import {
	analyticsBotKey,
	analyticsBotName,
} from "@/components/analytics/analytics-bot";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCount, formatPercent } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const RATINGS: ReadonlyArray<
	[
		ChatMessageRating,
		() => string,
	]
> = [
	[
		"very_much",
		m.chat_message_rate_option_very_much,
	],
	[
		"a_bit",
		m.chat_message_rate_option_a_bit,
	],
	[
		"not_really",
		m.chat_message_rate_option_not_really,
	],
	[
		"not_at_all",
		m.chat_message_rate_option_not_at_all,
	],
];

const total = (counts: Record<ChatMessageRating, number>) =>
	Object.values(counts).reduce((sum, count) => sum + count, 0);

/** Up are replies rated helpful at least a bit, down the rest. */
const upDown = (counts: Record<ChatMessageRating, number>) => {
	const up = (counts.very_much + counts.a_bit) / total(counts);
	return `${formatPercent(up)} / ${formatPercent(1 - up)}`;
};

export const RatingBreakdown = ({
	ratings,
}: {
	ratings: OrganizationAnalytics["ratings"];
}) => (
	<Card>
		<CardHeader>
			<CardTitle>{m.analytics_ratings_title()}</CardTitle>
			<CardDescription>{m.analytics_ratings_description()}</CardDescription>
		</CardHeader>
		<CardContent>
			{ratings.length === 0 ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					{m.analytics_ratings_empty()}
				</p>
			) : (
				<div className="max-h-96 overflow-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{m.analytics_bot_column_header()}</TableHead>
								<TableHead className="text-right">
									{m.analytics_ratings_count_column_header()}
								</TableHead>
								<TableHead className="text-right">
									{m.analytics_ratings_up_down_column_header()}
								</TableHead>
								{RATINGS.map(([rating, label]) => (
									<TableHead key={rating} className="text-right">
										{label()}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{ratings.map((row) => (
								<TableRow key={analyticsBotKey(row.bot)}>
									<TableCell className="max-w-72 truncate font-medium">
										{analyticsBotName(row.bot)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCount(total(row.counts))}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{upDown(row.counts)}
									</TableCell>
									{RATINGS.map(([rating]) => (
										<TableCell key={rating} className="text-right tabular-nums">
											{formatCount(row.counts[rating])}
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</CardContent>
	</Card>
);
