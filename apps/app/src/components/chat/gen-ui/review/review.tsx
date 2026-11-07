import { CopyIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { copyRevision } from "@/components/chat/gen-ui/review/copy";
import {
	retainedShare,
	wordDiff,
} from "@/components/chat/gen-ui/review/word-diff";
import { StatusIcon, Tally } from "@/components/chat/gen-ui/status-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	anchorFindings,
	itemStatus,
	type ReviewView,
	type StreamedFinding,
	type StreamedItem,
	severityLabel,
	severityStatus,
	stripEmphasis,
} from "@/lib/ai/tools/gen-ui/review/findings";
import type { Severity } from "@/lib/ai/tools/gen-ui/review/schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const textClass =
	"whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-[13px] leading-relaxed";

const markTone: Record<Severity, string> = {
	error: "decoration-status-danger bg-status-danger/8",
	warning: "decoration-status-warning bg-status-warning/12",
	info: "decoration-muted-foreground bg-muted",
};

/** The text with each anchored excerpt underlined and numbered. */
const Annotated = ({
	text,
	findings,
}: {
	text: string;
	findings: readonly StreamedFinding[];
}) => {
	const pieces: ReactNode[] = [];
	let cursor = 0;
	for (const { finding, start, end, number } of anchorFindings(
		text,
		findings,
	)) {
		pieces.push(text.slice(cursor, start));
		pieces.push(
			<mark
				key={number}
				className={cn(
					"text-foreground rounded-sm underline decoration-2 underline-offset-3",
					markTone[findings[finding].severity ?? "info"],
				)}
			>
				{text.slice(start, end)}
				<sup className="text-muted-foreground ml-0.5 text-[10px] font-medium">
					{number}
				</sup>
			</mark>,
		);
		cursor = end;
	}
	pieces.push(text.slice(cursor));
	return <p className={textClass}>{pieces}</p>;
};

/** Below half the original's words kept, before and after read better. */
const Diff = ({ before, after }: { before: string; after: string }) => {
	const revised = stripEmphasis(after);
	const tokens = wordDiff(before, revised);
	if (retainedShare(tokens) < 0.5) {
		return (
			<div className={cn(textClass, "space-y-1.5")}>
				<p className="text-status-danger decoration-status-danger/50 line-through">
					{before}
				</p>
				<p className="text-status-success">{revised}</p>
			</div>
		);
	}
	return (
		<p className={textClass}>
			{tokens.map((token, index) =>
				token.kind === "same" || token.text.trim() === "" ? (
					<span key={index}>{token.kind === "del" ? "" : token.text}</span>
				) : token.kind === "add" ? (
					<ins
						key={index}
						className="bg-status-success/15 text-status-success rounded-sm no-underline"
					>
						{token.text}
					</ins>
				) : (
					<del
						key={index}
						className="bg-status-danger/10 text-status-danger rounded-sm"
					>
						{token.text}
					</del>
				),
			)}
		</p>
	);
};

const Findings = ({
	findings,
	numbers,
}: {
	findings: readonly StreamedFinding[];
	numbers?: ReadonlyMap<number, number>;
}) => (
	<ul className="space-y-1.5">
		{findings.map((finding, index) => {
			const { severity } = finding;
			const number = numbers?.get(index);
			return (
				<li key={index} className="flex gap-2.5 text-sm">
					<StatusIcon
						status={severity && severityStatus[severity]}
						label={severity && severityLabel(severity)}
						className="mt-0.5"
					/>
					<div className="min-w-0 flex-1">
						<span className="font-medium">
							{number !== undefined && (
								<sup className="text-muted-foreground mr-1 text-[10px]">
									{number}
								</sup>
							)}
							{finding.label}
						</span>{" "}
						{finding.note && (
							<MessageResponse className="text-muted-foreground inline [&>p]:inline">
								{finding.note}
							</MessageResponse>
						)}
					</div>
				</li>
			);
		})}
	</ul>
);

const CopyRevisionButton = ({ markdown }: { markdown: string }) => (
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label={m.gen_ui_review_copy_revision()}
		title={m.gen_ui_review_copy_revision()}
		onClick={() => copyRevision(markdown)}
	>
		<CopyIcon />
	</Button>
);

const TABS = [
	"findings",
	"changes",
	"revised",
] as const;

type Tab = (typeof TABS)[number];

const ItemRow = ({
	item,
	tab,
	streaming,
}: {
	item: StreamedItem;
	tab: Exclude<Tab, "revised">;
	streaming: boolean;
}) => {
	const text = item.text ?? "";
	const findings = item.findings ?? [];
	const numbers = new Map(
		anchorFindings(text, findings).map(({ finding, number }) => [
			finding,
			number,
		]),
	);
	return (
		<li className="space-y-2.5 px-4 py-3">
			<div className="flex items-center gap-2">
				<StatusIcon status={itemStatus(item.findings)} pending={streaming} />
				<span className="flex-1 text-sm font-medium">{item.label}</span>
				{item.findings && findings.length === 0 && (
					<span className="text-muted-foreground text-xs">
						{m.gen_ui_review_no_findings()}
					</span>
				)}
				{item.revised && <CopyRevisionButton markdown={item.revised} />}
			</div>
			{text && (
				<div className="pl-6">
					{tab === "changes" && item.revised ? (
						<Diff before={text} after={item.revised} />
					) : (
						<Annotated text={text} findings={findings} />
					)}
				</div>
			)}
			{tab === "findings" && findings.length > 0 && (
				<div className="pl-6">
					<Findings findings={findings} numbers={numbers} />
				</div>
			)}
		</li>
	);
};

const RevisedView = ({ items }: { items: readonly StreamedItem[] }) => {
	const revisions = items.map((item) => item.revised ?? item.text ?? "");
	return (
		<div className="space-y-2 px-4 py-3">
			{revisions.map((revision, index) => (
				<div key={index} className="flex items-start gap-2">
					<MessageResponse className="flex-1 text-sm">
						{revision}
					</MessageResponse>
					<CopyRevisionButton markdown={revision} />
				</div>
			))}
			<div className="flex justify-end border-t pt-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						copyRevision(
							revisions.filter((revision) => revision !== "").join("\n\n"),
						)
					}
				>
					<CopyIcon />
					{m.gen_ui_review_copy_all()}
				</Button>
			</div>
		</div>
	);
};

const ReviewBody = ({
	view: { summary, items, general },
	tab,
	streaming,
}: {
	view: ReviewView;
	tab: Tab;
	streaming: boolean;
}) => (
	<>
		{summary && tab === "findings" && (
			<div className="text-muted-foreground border-b px-4 py-3 text-sm">
				<MessageResponse>{summary}</MessageResponse>
			</div>
		)}

		{tab === "revised" ? (
			<RevisedView items={items} />
		) : (
			<ul className="divide-y">
				{items.map((item, index) => (
					<ItemRow key={index} item={item} tab={tab} streaming={streaming} />
				))}
				{general.length > 0 && (
					<li className="bg-muted/30 space-y-2.5 px-4 py-3">
						<span className="text-sm font-medium">
							{m.gen_ui_review_overall()}
						</span>
						<Findings findings={general} />
					</li>
				)}
				{items.length === 0 && streaming && (
					<li className="space-y-2 px-4 py-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</li>
				)}
			</ul>
		)}
	</>
);

export const Review = ({
	view,
	streaming,
}: {
	view: ReviewView;
	streaming: boolean;
}) => {
	const [tab, setTab] = useState<Tab>("findings");
	const { title, items } = view;
	const hasRevisions = items.some((item) => item.revised);
	const heading = (
		<div className="min-w-0 space-y-1">
			{title ? (
				<h3 className="text-sm font-medium">{title}</h3>
			) : (
				<Skeleton className="h-4 w-40" />
			)}
			<Tally statuses={items.map((item) => itemStatus(item.findings))} />
		</div>
	);

	if (!hasRevisions)
		return (
			<div className="bg-card overflow-hidden rounded-xl border">
				<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
					{heading}
				</div>
				<ReviewBody view={view} tab="findings" streaming={streaming} />
			</div>
		);
	return (
		<Tabs
			value={tab}
			onValueChange={(value) => {
				const next = TABS.find((candidate) => candidate === value);
				if (next) setTab(next);
			}}
			className="bg-card gap-0 overflow-hidden rounded-xl border"
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				{heading}
				<TabsList
					aria-label={m.gen_ui_review_view_label()}
					className="h-auto max-w-full flex-wrap"
				>
					<TabsTrigger value="findings">
						{m.gen_ui_review_view_findings()}
					</TabsTrigger>
					<TabsTrigger value="changes">
						{m.gen_ui_review_view_changes()}
					</TabsTrigger>
					<TabsTrigger value="revised">
						{m.gen_ui_review_view_revised()}
					</TabsTrigger>
				</TabsList>
			</div>

			{TABS.map((value) => (
				<TabsContent key={value} value={value}>
					<ReviewBody view={view} tab={value} streaming={streaming} />
				</TabsContent>
			))}
		</Tabs>
	);
};
