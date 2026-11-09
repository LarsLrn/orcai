import { de } from "react-day-picker/locale/de";
import { enGB } from "react-day-picker/locale/en-GB";
import { getLocale } from "@/paraglide/runtime";

const DATE_LOCALES = {
	en: enGB,
	de,
};

/** The date-fns and DayPicker locale for the active language. */
export const getDateLocale = () => DATE_LOCALES[getLocale()];
