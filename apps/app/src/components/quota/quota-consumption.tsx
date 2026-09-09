import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/presentation/format-number";
import { cn } from "@/lib/utils";

const LOW_BALANCE_SHARE = 0.1;

/** The metering unit a quota pool's provider counts in. */
type QuotaUnit = "tokens" | "requests";

const hasAmount = (value: number | null | undefined): value is number =>
	value !== null && value !== undefined;

const formatAmount = (value: number | null | undefined) =>
	hasAmount(value) ? formatNumber(value) : "—";

const QuotaUnitLabel = ({
	unit,
	amount,
}: {
	unit: QuotaUnit | undefined;
	amount: number | null | undefined;
}) =>
	unit && hasAmount(amount) ? (
		<span className="text-muted-foreground text-xs">{unit}</span>
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
	unit?: QuotaUnit;
	className?: string;
}) => {
	const share = toShare(consumedAmount, budgetAmount);
	const percentage = share === null ? null : Math.round(share * 100);

	return (
		<div className={cn("flex items-center justify-end gap-2", className)}>
			<span className="tabular-nums">{formatAmount(consumedAmount)}</span>
			<QuotaUnitLabel unit={unit} amount={consumedAmount} />
			{percentage === null ? null : (
				<>
					<span className="text-muted-foreground text-xs tabular-nums">
						{percentage}%
					</span>
					<Progress
						value={percentage}
						aria-label={`${percentage} per cent of the budget consumed`}
						className="w-16 gap-0 **:data-[slot=progress-track]:h-1.5"
					/>
				</>
			)}
		</div>
	);
};

/** Remaining amount, marked when less than a tenth of the budget is left. */
const QuotaRemaining = ({
	remainingAmount,
	budgetAmount,
	unit,
	className,
}: {
	remainingAmount: number | null | undefined;
	budgetAmount: number | null | undefined;
	unit?: QuotaUnit;
	className?: string;
}) => {
	const share = toShare(remainingAmount, budgetAmount);
	const isLow = share !== null && share < LOW_BALANCE_SHARE;

	return (
		<div className={cn("flex items-center justify-end gap-2", className)}>
			<span
				className={cn(
					"font-medium tabular-nums",
					isLow && "text-status-warning",
				)}
			>
				{formatAmount(remainingAmount)}
			</span>
			<QuotaUnitLabel unit={unit} amount={remainingAmount} />
			{isLow ? <Badge variant="warning">Low</Badge> : null}
		</div>
	);
};

export type { QuotaUnit };
export { QuotaConsumption, QuotaRemaining };
