import { CURRENCIES } from "@orcai/schema";
import { getLocale } from "@/paraglide/runtime";

/** Every currency a provider may bill in, labelled with its code and name. */
export const currencyOptions = () => {
	const names = new Intl.DisplayNames(getLocale(), {
		type: "currency",
	});
	return CURRENCIES.map((code) => ({
		value: code,
		label: `${code} · ${names.of(code) ?? code}`,
	}));
};
