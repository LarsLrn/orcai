import { useNavigate } from "@tanstack/react-router";
import { useUmami } from "@/hooks/use-umami";
import { getLocale } from "@/paraglide/runtime";

/** Finishes a sign-in: into the app, which sends a user without an active organisation to the picker. */
export const useEnterApp = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const renderedLocale = getLocale();

	return (
		user:
			| {
					locale?: string | null;
			  }
			| undefined,
	) => {
		trackEvent("auth-login");
		// Sign-in set the stored locale's cookie; only a document load renders it.
		const storedLocale = user?.locale;
		if (storedLocale && storedLocale !== renderedLocale) {
			window.location.assign("/app");
			return;
		}
		navigate({
			to: "/app",
		});
	};
};
