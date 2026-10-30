import type { ProviderMeteringMode } from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/presentation/format-number";
import { getMeteringUnit } from "@/lib/presentation/metering-mode";
import { isLowShare, usedShareOf } from "@/lib/presentation/quota-share";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const hasAmount = (value: number | null | undefined): value is number =>
	value !== null && value !== undefined;

const formatAmount = (value: number | null | undefined) =>
	hasAmount(value) ? formatNumber(value) : "—";

const QuotaUnitLabel = ({
	unit,
	amount,
}: {
	unit: ProviderMeteringMode | undefined;
	amount: number | null | undefined;
}) =>
	unit && hasAmount(amount) ? (
		<span className="text-muted-foreground text-xs">
			{getMeteringUnit(unit, amount)}
		</span>
	) : null;

const toShare = (
	amount: number | null | undefined,
	budget: number | null | undefined,
) =>
	amount === null || amount === undefined || !budget || budget <= 0
		? null
		: Math.min(Math.max(amount / budget, 0), 1);

/** Consumed amount with the share of the budget it takes up. */
const QuotaConsumption = ({
	consumedAmount,
	budgetAmount,
	unit,
	className,
}: {
	consumedAmount: number | null | undefined;
	budgetAmount: number | null | undefined;
	unit?: ProviderMeteringMode;
	className?: string;
}) => {
	const share = toShare(consumedAmount, budgetAmount);
	const percentage = share === null ? null : Math.round(share * 100);

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<span className="tabular-nums">{formatAmount(consumedAmount)}</span>
			<QuotaUnitLabel unit={unit} amount={consumedAmount} />
			{percentage === null ? null : (
				<>
					<span className="text-muted-foreground text-xs tabular-nums">
						{percentage}%
					</span>
					<Progress
						value={percentage}
						aria-label={m.quotas_consumption_progress_aria_label({
							percentage,
						})}
						className="w-16 gap-0 **:data-[slot=progress-track]:h-1.5"
					/>
				</>
			)}
		</div>
	);
};

/** Remaining amount, marked when the pool runs low. */
const QuotaRemaining = ({
	remainingAmount,
	budgetAmount,
	unit,
	className,
}: {
	remainingAmount: number | null | undefined;
	budgetAmount: number | null | undefined;
	unit?: ProviderMeteringMode;
	className?: string;
}) => {
	const isLow =
		hasAmount(remainingAmount) &&
		hasAmount(budgetAmount) &&
		budgetAmount > 0 &&
		isLowShare(
			usedShareOf({
				budgetAmount,
				remainingAmount,
			}),
		);

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<span
				className={cn(
					"font-medium tabular-nums",
					isLow && "text-status-warning",
				)}
			>
				{formatAmount(remainingAmount)}
			</span>
			<QuotaUnitLabel unit={unit} amount={remainingAmount} />
			{isLow ? (
				<Badge variant="warning">{m.quotas_remaining_low_badge()}</Badge>
			) : null}
		</div>
	);
};

export { QuotaConsumption, QuotaRemaining };
