const LOW_SHARE = 0.9;

/** What a pool's budget has consumed or reserved, 0 to 1; a zero budget counts as used up. */
const usedShareOf = ({
	budgetAmount,
	remainingAmount,
}: {
	budgetAmount: number;
	remainingAmount: number;
}) =>
	budgetAmount <= 0
		? 1
		: Math.min(Math.max((budgetAmount - remainingAmount) / budgetAmount, 0), 1);

const isLowShare = (usedShare: number) => usedShare >= LOW_SHARE;

const isExhaustedShare = (usedShare: number) => usedShare >= 1;

export { isExhaustedShare, isLowShare, usedShareOf };
