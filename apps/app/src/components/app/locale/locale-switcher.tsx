import { m } from "@/paraglide/messages";
import { getLocale, locales } from "@/paraglide/runtime";
import { LOCALE_NAMES } from "./locale-names";
import { LocaleSwitcherSelect } from "./locale-switcher-select";

const LocaleSwitcher = () => {
	const locale = getLocale();

	return (
		<LocaleSwitcherSelect
			defaultValue={locale}
			items={locales.map((value) => ({
				value,
				label: LOCALE_NAMES[value],
			}))}
			label={m.header_locale_switcher_label()}
		/>
	);
};

export { LocaleSwitcher };
