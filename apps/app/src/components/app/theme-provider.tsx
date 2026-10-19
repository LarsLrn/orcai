import { ScriptOnce } from "@tanstack/react-router";
import Cookies from "js-cookie";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Theme = "dark" | "light" | "system";

export const THEME_COOKIE_NAME = "theme";
const THEME_COOKIE_MAX_AGE_DAYS = 365;

export function parseTheme(value: string | undefined): Theme {
	return value === "light" || value === "dark" ? value : "system";
}

type ThemeProviderProps = {
	children: React.ReactNode;
	initialTheme: Theme;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

// The server renders an explicit theme on <html>; this resolves "system" before paint.
// Inlined as source, so it must stay self-contained.
function applySystemTheme() {
	const root = document.documentElement;
	if (root.classList.contains("light") || root.classList.contains("dark")) {
		return;
	}
	const resolved = matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
	root.classList.add(resolved);
	root.style.colorScheme = resolved;
}

const ThemeProviderContext = createContext<ThemeProviderState>({
	theme: "system",
	// biome-ignore lint/suspicious/noEmptyBlockStatements: initial value, will be overridden by provider
	setTheme: () => {},
});

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	root.classList.remove("light", "dark");

	const resolved =
		theme === "system"
			? window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
			: theme;

	root.classList.add(resolved);
	root.style.colorScheme = resolved;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
	const [theme, setThemeState] = useState(initialTheme);

	useEffect(() => {
		applyTheme(theme);
		if (theme !== "system") return;

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [
		theme,
	]);

	const setTheme = useCallback((next: Theme) => {
		try {
			Cookies.set(THEME_COOKIE_NAME, next, {
				expires: THEME_COOKIE_MAX_AGE_DAYS,
				path: "/",
				sameSite: "Lax",
			});
		} catch {
			// The theme still applies for this page without being stored.
		}
		setThemeState(next);
	}, []);

	// A fresh value would make React discard server HTML in unhydrated Suspense boundaries.
	const value = useMemo(
		() => ({
			theme,
			setTheme,
		}),
		[
			theme,
			setTheme,
		],
	);

	return (
		<ThemeProviderContext value={value}>
			<ScriptOnce>{`(${applySystemTheme})()`}</ScriptOnce>
			{children}
		</ThemeProviderContext>
	);
}

export function useTheme() {
	return useContext(ThemeProviderContext);
}
