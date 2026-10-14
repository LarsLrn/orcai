import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { LocaleSwitcherSelect } from "./locale-switcher-select";

const LocaleSwitcher = () => {
	const locale = getLocale();

	return (
		<LocaleSwitcherSelect
			defaultValue={locale}
			items={[
				{
					value: "en",
					label: "English",
				},
				{
					value: "de",
					label: "Deutsch",
				},
			]}
			label={m.header_locale_switcher_label()}
		/>
	);
};

export { LocaleSwitcher };
