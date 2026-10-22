import { getLocale } from "@/paraglide/runtime";

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (
	kind: string,
	options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat => {
	const locale = getLocale();
	const key = `${locale}:${kind}`;
	const cached = formatterCache.get(key);
	if (cached) {
		return cached;
	}

	const formatter = new Intl.NumberFormat(locale, options);
	formatterCache.set(key, formatter);
	return formatter;
};

const formatCount = (value: number) => getFormatter("count").format(value);

const formatCompactNumber = (value: number) =>
	getFormatter("compact", {
		notation: "compact",
	}).format(value);

const formatPercent = (value: number) =>
	getFormatter("percent", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(value);

const formatNumber = (value: number | null | undefined, missing = "—") =>
	value === null || value === undefined ? missing : formatCount(value);

/** A price with every decimal it was entered with. */
const formatPrice = (value: number, currency: string) =>
	getFormatter(`price:${currency}`, {
		style: "currency",
		currency,
		maximumFractionDigits: 6,
	}).format(value);

/** An amount of money; amounts below one keep up to four decimals. */
const formatMoney = (value: number, currency: string) =>
	Math.abs(value) < 1
		? getFormatter(`money-small:${currency}`, {
				style: "currency",
				currency,
				maximumFractionDigits: 4,
			}).format(value)
		: getFormatter(`money:${currency}`, {
				style: "currency",
				currency,
			}).format(value);

/** Amounts in micro-units, one per currency, as "€12.30 + $4.10". */
const formatCosts = (
	costs: readonly {
		currency: string;
		amount: number;
	}[],
	missing: string,
) =>
	costs.length === 0
		? missing
		: costs
				.map(({ currency, amount }) =>
					formatMoney(amount / 1_000_000, currency),
				)
				.join(" + ");

export {
	formatCompactNumber,
	formatCosts,
	formatCount,
	formatNumber,
	formatPercent,
	formatPrice,
};
