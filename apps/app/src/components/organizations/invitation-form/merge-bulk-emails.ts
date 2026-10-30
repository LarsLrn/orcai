type EmailRow = {
	email: string;
};

/**
 * The form's email rows after a bulk paste: the filled rows, then each
 * pasted address that is not there yet. Blank rows give way to the pasted
 * ones, and a paste without a new address leaves the rows as they are.
 */
export const mergeBulkEmails = (
	rows: readonly EmailRow[],
	pasted: string,
): EmailRow[] => {
	const filled = rows.filter((row) => row.email.trim() !== "");
	const seen = new Set(filled.map((row) => row.email.trim().toLowerCase()));
	const added: EmailRow[] = [];

	for (const line of pasted.split("\n")) {
		const email = line.trim();
		const key = email.toLowerCase();
		if (email === "" || seen.has(key)) continue;
		seen.add(key);
		added.push({
			email,
		});
	}

	return added.length === 0
		? [
				...rows,
			]
		: [
				...filled,
				...added,
			];
};
