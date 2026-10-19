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

export { formatCompactNumber, formatCount, formatNumber, formatPercent };
