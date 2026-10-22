import type { AnalyticsUsage } from "@orcai/schema";
import type { ReactNode } from "react";
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
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

interface Column<Row> {
	header: string;
	cell: (row: Row) => ReactNode;
}

/** Usage per person, bot, model or organisation, most tokens first. */
export const UsageBreakdown = <Row extends AnalyticsUsage>({
	title,
	description,
	nameHeader,
	rows,
	rowKey,
	name,
	columns = [],
	empty,
}: {
	title: string;
	description: string;
	nameHeader: string;
	rows: Row[];
	rowKey: (row: Row) => string;
	name: (row: Row) => ReactNode;
	columns?: Column<Row>[];
	empty: ReactNode;
}) => (
	<Card>
		<CardHeader>
			<CardTitle>{title}</CardTitle>
			<CardDescription>{description}</CardDescription>
		</CardHeader>
		<CardContent>
			{rows.length === 0 ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					{empty}
				</p>
			) : (
				<div className="max-h-96 overflow-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{nameHeader}</TableHead>
								{columns.map((column) => (
									<TableHead key={column.header} className="text-right">
										{column.header}
									</TableHead>
								))}
								<TableHead className="text-right">
									{m.analytics_metric_total_tokens()}
								</TableHead>
								<TableHead className="text-right">
									{m.analytics_metric_requests()}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={rowKey(row)}>
									<TableCell className="max-w-72">{name(row)}</TableCell>
									{columns.map((column) => (
										<TableCell
											key={column.header}
											className="text-right tabular-nums"
										>
											{column.cell(row)}
										</TableCell>
									))}
									<TableCell className="text-right tabular-nums">
										{formatCount(row.totalTokens)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCount(row.requests)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</CardContent>
	</Card>
);

/** A name over a muted second line, both truncated. */
export const TwoLineName = ({
	primary,
	secondary,
}: {
	primary: ReactNode;
	secondary?: ReactNode;
}) => (
	<div className="min-w-0">
		<div className="truncate font-medium">{primary}</div>
		{secondary ? (
			<div className="truncate text-muted-foreground text-xs">{secondary}</div>
		) : null}
	</div>
);
