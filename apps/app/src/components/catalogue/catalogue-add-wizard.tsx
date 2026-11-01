import type {
	CatalogueEntryDetail,
	CatalogueEntryRef,
	CatalogueKind,
} from "@orcai/schema";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	LibraryIcon,
	MessageSquarePlusIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddedAccessContent } from "@/components/access/access-manager-content";
import {
	BotModelStep,
	type BotModelStepHandle,
} from "@/components/bot/setup/bot-model-step";
import { useActiveOrganizationName } from "@/components/catalogue/catalogue-adder";
import { catalogueReturnLink } from "@/components/catalogue/catalogue-browse";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { hasCapability } from "@/lib/authz/capabilities";
import type { CatalogueOrigin } from "@/lib/catalogue/catalogue-filters";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { libraryLink } from "@/lib/navigation/library-link";
import { orpc } from "@/lib/orpc/orpc";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { catalogueEntryRef } from "@/lib/router/catalogue-entry-loader";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type WizardStep = "sharing" | "model" | "done";

const STEP_LABELS: Record<WizardStep, () => string> = {
	sharing: m.catalogue_wizard_step_sharing,
	model: m.catalogue_wizard_step_model,
	done: m.catalogue_wizard_step_done,
};

/** Bots get a model in the organisation; blocks keep their settings on the definition. */
const stepsFor = (entry: Pick<CatalogueEntryDetail, "kind">): WizardStep[] =>
	entry.kind === "bot"
		? [
				"sharing",
				"model",
				"done",
			]
		: [
				"sharing",
				"done",
			];

const Stepper = ({
	steps,
	index,
}: {
	steps: readonly WizardStep[];
	index: number;
}) => (
	<ol className="flex items-center gap-2 text-sm">
		{steps.map((step, position) => (
			<li
				key={step}
				aria-current={position === index ? "step" : undefined}
				className="flex flex-1 items-center gap-2 last:flex-none"
			>
				<span
					className={cn(
						"flex size-6 shrink-0 items-center justify-center rounded-full border font-medium text-xs",
						position < index &&
							"border-primary bg-primary text-primary-foreground",
						position === index && "border-primary text-primary",
					)}
				>
					{position < index ? (
						<CheckIcon aria-hidden="true" className="size-3.5" />
					) : (
						position + 1
					)}
				</span>
				<span
					className={cn(
						position === index ? "font-medium" : "text-muted-foreground",
					)}
				>
					{STEP_LABELS[step]()}
				</span>
				{position < steps.length - 1 ? (
					<span aria-hidden="true" className="h-px flex-1 bg-border" />
				) : null}
			</li>
		))}
	</ol>
);

/** Who in the organisation may use what it added: viewer grants issued here. */
const SharingStep = ({
	entryRef,
	entry,
	organisation,
}: {
	entryRef: CatalogueEntryRef;
	entry: CatalogueEntryDetail;
	organisation: string;
}) => (
	<Card className="min-w-0 rounded-2xl">
		<CardHeader>
			<CardTitle>
				{m.catalogue_wizard_sharing_title({
					organisation,
				})}
			</CardTitle>
			<CardDescription>
				{m.catalogue_wizard_sharing_description()}
			</CardDescription>
		</CardHeader>
		<CardContent>
			<AddedAccessContent
				resourceRef={
					entryRef.resourceType === "bot"
						? {
								type: "bot",
								id: entryRef.resourceId,
							}
						: {
								type: "block",
								id: entryRef.resourceId,
							}
				}
				from={entry.homeOrganization}
			/>
		</CardContent>
	</Card>
);

/** What is next: a chat with the bot when the user may use it, the Library or more of the catalogue. */
const DoneStep = ({
	entryRef,
	entry,
	organisation,
	from,
}: {
	entryRef: CatalogueEntryRef;
	entry: CatalogueEntryDetail;
	organisation: string;
	from: CatalogueOrigin | undefined;
}) => {
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input:
				entryRef.resourceType === "bot"
					? {
							id: entryRef.resourceId,
						}
					: skipToken,
		}),
	);
	return (
		<div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-10 text-center">
			<div className="flex size-14 items-center justify-center rounded-full bg-status-success/12 text-status-success">
				<CheckIcon aria-hidden="true" className="size-7" />
			</div>
			<div className="flex flex-col gap-1">
				<h2 className="font-heading font-semibold text-xl">
					{m.catalogue_wizard_done_title({
						name: entry.name,
						organisation,
					})}
				</h2>
				<p className="text-muted-foreground text-sm">
					{m.catalogue_wizard_done_description({
						organisation: entry.homeOrganization.name,
					})}
				</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				{bot && hasCapability(bot.data.capabilities, "use") ? (
					<Link
						to="/app/chat/new"
						search={{
							botId: bot.data.id,
						}}
						className={buttonVariants()}
					>
						<MessageSquarePlusIcon
							data-icon="inline-start"
							aria-hidden="true"
						/>
						{m.bots_detail_start_chat_action()}
					</Link>
				) : null}
				<Link
					{...libraryLink(entry)}
					className={buttonVariants({
						variant: "outline",
					})}
				>
					<LibraryIcon data-icon="inline-start" aria-hidden="true" />
					{m.catalogue_open_in_library_action()}
				</Link>
				<Link
					{...catalogueReturnLink(from, entry.kind)}
					className={buttonVariants({
						variant: "ghost",
					})}
				>
					{m.catalogue_wizard_back_to_catalogue_action()}
				</Link>
			</div>
		</div>
	);
};

/**
 * Sets up an entry the active organisation added: Sharing, then Model for
 * bots, then Done. Each step saves through its own procedure.
 */
export const CatalogueAddWizard = ({
	kind,
	id,
	from,
}: {
	kind: CatalogueKind;
	id: string;
	from: CatalogueOrigin | undefined;
}) => {
	const ref = catalogueEntryRef(kind, id);
	const { data } = useSuspenseQuery(
		orpc.catalogue.find.queryOptions({
			input: {
				entry: ref,
			},
		}),
	);
	const entry = data.data;
	const organisation = useActiveOrganizationName() ?? "";
	const steps = stepsFor(entry);
	const [index, setIndex] = useState(0);
	const [saving, setSaving] = useState(false);
	const modelStep = useRef<BotModelStepHandle>(null);
	// The model form hands over its handle once its setup has loaded.
	const [modelReady, setModelReady] = useState(false);
	const attachModelStep = useCallback((handle: BotModelStepHandle | null) => {
		modelStep.current = handle;
		setModelReady(handle !== null);
	}, []);
	const step = steps[index] ?? "sharing";
	const stepHeading = useRef<HTMLHeadingElement>(null);
	// A new step takes focus, so keyboard and screen reader users land on it.
	const shownIndex = useRef(index);
	useEffect(() => {
		if (shownIndex.current === index) return;
		shownIndex.current = index;
		stepHeading.current?.focus();
	}, [
		index,
	]);
	const { Icon, well } = RESOURCE_KINDS[entry.kind];
	const paths = cataloguePaths(entry.kind);

	const next = async () => {
		if (step === "model") {
			setSaving(true);
			const saved = (await modelStep.current?.save()) ?? false;
			setSaving(false);
			if (!saved) return;
		}
		setIndex(index + 1);
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<Link
				to={paths.detail}
				params={{
					id: entry.id,
				}}
				search={{
					from,
				}}
				className={buttonVariants({
					variant: "ghost",
					size: "sm",
					className: "self-start",
				})}
			>
				<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
				{entry.name}
			</Link>
			<header className="flex items-center gap-4">
				<span
					className={cn(
						"flex size-14 shrink-0 items-center justify-center rounded-2xl [&>svg]:size-7",
						well,
					)}
				>
					<Icon aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<p className="text-muted-foreground text-sm">
						{m.catalogue_add_action({
							organisation,
						})}
					</p>
					<h1 className="break-words font-heading font-semibold text-3xl tracking-tight">
						{entry.name}
					</h1>
				</div>
			</header>
			<Stepper steps={steps} index={index} />
			<h2
				ref={stepHeading}
				tabIndex={-1}
				className="-mb-4 font-medium text-muted-foreground text-sm outline-none"
			>
				{m.catalogue_wizard_step_heading({
					position: index + 1,
					count: steps.length,
					step: STEP_LABELS[step](),
				})}
			</h2>
			{step === "sharing" ? (
				<SharingStep entryRef={ref} entry={entry} organisation={organisation} />
			) : step === "model" && ref.resourceType === "bot" ? (
				<BotModelStep
					botId={ref.resourceId}
					ref={attachModelStep}
					authorsPick={
						entry.modelHint
							? {
									hint: entry.modelHint,
									modelId: entry.authorsPick,
									author: entry.homeOrganization.name,
									organisation,
								}
							: undefined
					}
				/>
			) : (
				<DoneStep
					entryRef={ref}
					entry={entry}
					organisation={organisation}
					from={from}
				/>
			)}
			{step === "done" ? null : (
				<div className="flex items-center justify-between gap-2">
					<Button
						variant="outline"
						disabled={index === 0 || saving}
						onClick={() => setIndex(index - 1)}
					>
						<ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
						{m.common_back_button()}
					</Button>
					<div className="flex gap-2">
						{step === "model" ? (
							<Button
								variant="ghost"
								disabled={saving}
								onClick={() => setIndex(index + 1)}
							>
								{m.catalogue_wizard_skip_action()}
							</Button>
						) : null}
						<Button
							loading={saving}
							disabled={step === "model" && !modelReady}
							onClick={() => void next()}
						>
							{steps[index + 1] === "done"
								? m.catalogue_wizard_finish_action()
								: m.common_next_button()}
							<ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};
