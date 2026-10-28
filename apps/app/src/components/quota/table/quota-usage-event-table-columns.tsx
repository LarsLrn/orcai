import type {
	QuotaUsageEventListRow,
	QuotaUsageEventType,
} from "@orcai/schema";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { formatNumber } from "@/lib/presentation/format-number";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const eventTypeLabel = (eventType: QuotaUsageEventType) => {
	switch (eventType) {
		case "reserved":
			return m.quotas_event_type_reserved();
		case "finalized":
			return m.quotas_event_type_finalized();
		case "released":
			return m.quotas_event_type_released();
		case "failed":
			return m.quotas_event_type_failed();
	}
};

const eventTypeVariant = {
	reserved: "outline",
	finalized: "secondary",
	released: "outline",
	failed: "destructive",
} as const satisfies Record<QuotaUsageEventType, string>;

export const quotaUsageEventTypeOptions = () =>
	(
		[
			"reserved",
			"finalized",
			"released",
			"failed",
		] as const
	).map((value) => ({
		value,
		label: eventTypeLabel(value),
	}));

const columnHelper = createColumnHelper<
	DataTableFeatures,
	QuotaUsageEventListRow
>();

export const quotaUsageEventTableColumns = columnHelper.columns([
	columnHelper.accessor("occurredAt", {
		size: 180,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_events_time_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap tabular-nums">
				{formatDisplayTimestamp(row.original.occurredAt)}
			</span>
		),
		meta: {
			label: m.quotas_events_time_column_header,
		},
	}),
	columnHelper.accessor("eventType", {
		size: 120,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_detail_event_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={eventTypeVariant[row.original.eventType]}>
				{eventTypeLabel(row.original.eventType)}
			</Badge>
		),
		meta: {
			label: m.quotas_detail_event_column_header,
		},
	}),
	columnHelper.accessor("user", {
		size: 220,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_events_user_column_header()}
			/>
		),
		cell: ({ row: { original } }) =>
			original.user.kind === "member" ? (
				<div className="min-w-0">
					<p className="truncate font-medium">{original.user.name}</p>
					<p className="truncate text-muted-foreground text-xs">
						{original.user.email}
					</p>
				</div>
			) : (
				<span className="text-muted-foreground">
					{m.quotas_events_former_member_label()}
				</span>
			),
		meta: {
			label: m.quotas_events_user_column_header,
		},
	}),
	columnHelper.accessor("model", {
		size: 180,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_events_model_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="truncate">{row.original.model?.name ?? "—"}</span>
		),
		meta: {
			label: m.quotas_events_model_column_header,
		},
	}),
	columnHelper.accessor("bot", {
		size: 160,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_events_bot_column_header()}
			/>
		),
		cell: ({ row: { original } }) => {
			switch (original.bot.kind) {
				case "bot":
					return <span className="truncate">{original.bot.name}</span>;
				case "none":
					return "—";
				case "other":
					return (
						<span className="text-muted-foreground">
							{m.quotas_events_other_bot_label()}
						</span>
					);
			}
		},
		meta: {
			label: m.quotas_events_bot_column_header,
		},
	}),
	columnHelper.accessor("reservedAmount", {
		size: 140,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_detail_reserved_amount_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatNumber(row.original.reservedAmount)}
			</span>
		),
		meta: {
			label: m.quotas_detail_reserved_amount_column_header,
		},
	}),
	columnHelper.accessor("actualAmount", {
		size: 140,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_detail_actual_amount_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatNumber(row.original.actualAmount)}
			</span>
		),
		meta: {
			label: m.quotas_detail_actual_amount_column_header,
		},
	}),
	columnHelper.accessor("totalTokens", {
		size: 120,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_events_tokens_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatNumber(row.original.totalTokens)}
			</span>
		),
		meta: {
			label: m.quotas_events_tokens_column_header,
		},
	}),
	columnHelper.accessor("appRequestId", {
		size: 200,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_detail_request_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span
				className="block max-w-48 truncate font-mono text-muted-foreground text-xs"
				title={row.original.appRequestId}
			>
				{row.original.appRequestId}
			</span>
		),
		meta: {
			label: m.quotas_detail_request_column_header,
		},
	}),
]);
