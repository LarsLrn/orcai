const countFormatter = new Intl.NumberFormat("en-GB");

const compactNumberFormatter = new Intl.NumberFormat("en-GB", {
	notation: "compact",
});

const percentFormatter = new Intl.NumberFormat("en-GB", {
	style: "percent",
	maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat();

const formatCount = (value: number) => countFormatter.format(value);

const formatCompactNumber = (value: number) =>
	compactNumberFormatter.format(value);

const formatPercent = (value: number) => percentFormatter.format(value);

const formatNumber = (value: number | null | undefined, missing = "—") =>
	value === null || value === undefined
		? missing
		: numberFormatter.format(value);

export { formatCompactNumber, formatCount, formatNumber, formatPercent };
