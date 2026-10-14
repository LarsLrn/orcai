import { getLocale } from "@/paraglide/runtime";

const UNITS = [
	"byte",
	"kilobyte",
	"megabyte",
	"gigabyte",
	"terabyte",
] as const;

const formatFileSize = (bytes: number) => {
	const index =
		bytes > 0
			? Math.min(UNITS.length - 1, Math.floor(Math.log10(bytes) / 3))
			: 0;

	return new Intl.NumberFormat(getLocale(), {
		style: "unit",
		unit: UNITS[index] ?? "byte",
		unitDisplay: "short",
		maximumFractionDigits: index === 0 ? 0 : 1,
	}).format(bytes / 1000 ** index);
};

export { formatFileSize };
