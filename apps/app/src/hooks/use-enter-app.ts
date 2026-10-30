import { localeSchema } from "@orcai/schema";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useUmami } from "@/hooks/use-umami";
import { getLocale } from "@/paraglide/runtime";

/**
 * Finishes a sign-in: into the app, which sends a user without an active
 * organisation to the picker, or back to the invitation the sign-in started from.
 */
export const useEnterApp = () => {
	const navigate = useNavigate();
	const { inv } = useSearch({
		strict: false,
	});
	const { trackEvent } = useUmami();
	const renderedLocale = getLocale();

	return (user: object) => {
		trackEvent("auth-login");
		// Sign-in set the stored locale's cookie; only a document load renders it.
		const storedLocale = localeSchema.safeParse(
			"locale" in user ? user.locale : undefined,
		);
		const destination = inv
			? ({
					to: "/register",
					search: {
						inv,
					},
				} as const)
			: ({
					to: "/app",
				} as const);
		navigate({
			...destination,
			reloadDocument:
				storedLocale.success && storedLocale.data !== renderedLocale,
		});
	};
};
