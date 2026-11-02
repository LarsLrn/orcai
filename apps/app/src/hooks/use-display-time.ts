import { useRouteContext } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import Cookies from "js-cookie";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
	formatDisplayDate,
	formatDisplayTimestamp,
} from "@/lib/presentation/format-timestamp";

const TIME_ZONE_COOKIE_NAME = "time_zone";
const TIME_ZONE_COOKIE_MAX_AGE_DAYS = 365;

/** A time zone Intl knows, UTC otherwise. */
const parseTimeZone = (value: string | undefined) => {
	if (!value) return "UTC";

	try {
		return new Intl.DateTimeFormat("en", {
			timeZone: value,
		}).resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
};

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The zone a page renders in: on the server the one the `time_zone` cookie
 * names. The root route keeps it in its context, which hydration reuses.
 */
export const getRenderTimeZone = createIsomorphicFn()
	.server(() => parseTimeZone(getCookie(TIME_ZONE_COOKIE_NAME)))
	.client(browserTimeZone);

const subscribe = () => () => undefined;

/**
 * Date formatters in the browser's time zone. Hydration uses the zone the
 * server rendered in before React re-renders in the browser's, so the markup
 * matches either way.
 */
export const useDisplayTime = () => {
	const renderTimeZone = useRouteContext({
		from: "__root__",
		select: (context) => context.timeZone,
	});
	const timeZone = useSyncExternalStore(
		subscribe,
		browserTimeZone,
		() => renderTimeZone,
	);

	useEffect(() => {
		const browser = browserTimeZone();
		if (Cookies.get(TIME_ZONE_COOKIE_NAME) === browser) return;

		Cookies.set(TIME_ZONE_COOKIE_NAME, browser, {
			expires: TIME_ZONE_COOKIE_MAX_AGE_DAYS,
			path: "/",
			sameSite: "Lax",
			secure: window.location.protocol === "https:",
		});
	}, []);

	return useMemo(
		() => ({
			/** Date and time, written the way the active locale writes it. */
			timestamp: (value: Date | string | number) =>
				formatDisplayTimestamp(value, timeZone),
			/** Date only, written the way the active locale writes it. */
			date: (value: Date | string | number) =>
				formatDisplayDate(value, timeZone),
		}),
		[
			timeZone,
		],
	);
};
