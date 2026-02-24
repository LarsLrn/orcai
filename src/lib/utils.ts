import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const getNameInitial = (name: string | undefined | null) => {
	let initial = "U";

	if (name && name.length > 0) {
		initial = name[0].toUpperCase();
	}

	return initial;
};
