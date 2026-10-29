function isValidUrl(url: string) {
	return /^(https?:\/\/|mailto:|tel:)\S+$/.test(url);
}

export function getUrlFromString(str: string) {
	if (isValidUrl(str)) {
		return str;
	}
	if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(str)) {
		return `mailto:${str}`;
	}
	try {
		if (str.includes(".") && !str.includes(" ")) {
			return new URL(`https://${str}`).toString();
		}
	} catch {
		return null;
	}
}
