import type { EmbeddingProgress } from "@orcai/schema";
import { FormSection } from "@/components/forms/form-layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { describePipelineFailure } from "@/lib/presentation/asset-state";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

/** The files embedded, waiting and failed per organisation, without naming any of them. */
export const SearchIndexSection = ({
	progress,
}: {
	progress: EmbeddingProgress;
}) => {
	const total = progress.organizations.reduce(
		(sum, row) => sum + row.embedded + row.waiting + row.failed,
		0,
	);
	const embedded = progress.organizations.reduce(
		(sum, row) => sum + row.embedded,
		0,
	);
	const retry = useMutationAction({
		mutationOptions: () =>
			orpc.instanceSettings.retryFailedEmbeddings.mutationOptions(),
		messages: {
			loading: m.blocks_prepare_failed_again_toast_loading(),
			success: ({ data }) =>
				m.blocks_prepare_failed_again_toast_success({
					count: data.data.admitted,
				}),
			error: m.blocks_prepare_failed_again_toast_error(),
		},
		confirm: {
			title: m.instance_settings_index_retry_confirm_title({
				count: progress.retryable,
			}),
			description: m.instance_settings_index_retry_confirm_description(),
			confirmText: m.instance_settings_index_retry_confirm_button(),
			confirmButton: {
				variant: "default",
			},
		},
	});
	const prepareAgain = useMutationAction({
		mutationOptions: () =>
			orpc.instanceSettings.prepareMissingExtractionsAgain.mutationOptions(),
		messages: {
			loading: m.instance_settings_index_prepare_again_toast_loading(),
			success: ({ data }) =>
				m.instance_settings_index_prepare_again_toast_success({
					count: data.data.queued,
				}),
			error: m.instance_settings_index_prepare_again_toast_error(),
		},
		confirm: {
			title: m.instance_settings_index_prepare_again_confirm_title({
				count: progress.preparable,
			}),
			description:
				m.instance_settings_index_prepare_again_confirm_description(),
			confirmText: m.instance_settings_index_prepare_again_confirm_button(),
			confirmButton: {
				variant: "default",
			},
		},
	});
	const reembed = useMutationAction({
		mutationOptions: () =>
			orpc.instanceSettings.reembedEmbeddings.mutationOptions(),
		messages: {
			loading: m.instance_settings_index_reembed_toast_loading(),
			success: ({ data }) =>
				data.data.started
					? m.instance_settings_index_reembed_toast_success()
					: m.instance_settings_index_reembed_toast_replaced(),
			error: m.instance_settings_index_reembed_toast_error(),
		},
		confirm: {
			title: m.instance_settings_index_reembed_confirm_title(),
			description: m.instance_settings_index_reembed_confirm_description({
				count: total,
			}),
			confirmText: m.instance_settings_index_reembed_confirm_button(),
		},
	});

	return (
		<FormSection
			title={m.instance_settings_index_title()}
			description={m.instance_settings_index_description()}
		>
			{total === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.instance_settings_index_empty()}
				</p>
			) : (
				<>
					<Progress value={(embedded / total) * 100}>
						<span className="text-sm">
							{m.instance_settings_index_progress({
								embedded: formatCount(embedded),
								total: formatCount(total),
							})}
						</span>
					</Progress>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									{m.instance_settings_index_organization_column()}
								</TableHead>
								<TableHead className="text-right">
									{m.instance_settings_index_embedded_column()}
								</TableHead>
								<TableHead className="text-right">
									{m.instance_settings_index_waiting_column()}
								</TableHead>
								<TableHead className="text-right">
									{m.instance_settings_index_failed_column()}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{progress.organizations.map((row) => (
								<TableRow key={row.organizationId ?? ""}>
									<TableCell>
										{row.name ?? m.instance_settings_index_no_organization()}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCount(row.embedded)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCount(row.waiting)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatCount(row.failed)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</>
			)}

			{progress.failures.length > 0 && (
				<section
					aria-label={m.instance_settings_index_failures_title()}
					className="flex flex-col gap-2"
				>
					<h3 className="font-medium text-sm">
						{m.instance_settings_index_failures_title()}
					</h3>
					<ul className="flex flex-col gap-1 text-sm">
						{progress.failures.map(({ failure, count }) => (
							<li key={failure} className="flex justify-between gap-4">
								<span className="text-muted-foreground">
									{describePipelineFailure(failure)}
								</span>
								<span className="tabular-nums">{formatCount(count)}</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{progress.preparable > 0 && (
				<p className="text-muted-foreground text-sm">
					{m.instance_settings_index_prepare_again_description()}
				</p>
			)}

			<div className="flex flex-wrap justify-end gap-2">
				{progress.preparable > 0 && (
					<Button
						variant="outline"
						loading={prepareAgain.isPending}
						onClick={() => void prepareAgain.mutateAsync({})}
					>
						{m.instance_settings_index_prepare_again_button()}
					</Button>
				)}
				<Button
					variant="outline"
					disabled={progress.retryable === 0}
					loading={retry.isPending}
					onClick={() => void retry.mutateAsync({})}
				>
					{m.instance_settings_index_retry_button()}
				</Button>
				<Button
					variant="outline"
					loading={reembed.isPending}
					onClick={() =>
						void reembed.mutateAsync({
							generation: progress.generation,
						})
					}
				>
					{m.instance_settings_index_reembed_button()}
				</Button>
			</div>
		</FormSection>
	);
};
