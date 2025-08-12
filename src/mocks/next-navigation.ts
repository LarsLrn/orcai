/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: <Mock functions> */

// Mock for Next.js navigation to prevent build errors with nextstepjs
// This file is used to mock Next.js imports when using nextstepjs in a Vite app

export const useRouter = () => {
	return {
		push: () => {},
		replace: () => {},
		prefetch: () => {},
		back: () => {},
		forward: () => {},
		refresh: () => {},
	};
};

export const usePathname = () => {
	return "";
};

export const useSearchParams = () => {
	return new URLSearchParams();
};

export const useParams = () => {
	return {};
};
