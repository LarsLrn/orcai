import { getLocale } from "@/paraglide/runtime";

export const formatList = (items: string[]) =>
	new Intl.ListFormat(getLocale(), {
		type: "conjunction",
	}).format(items);
