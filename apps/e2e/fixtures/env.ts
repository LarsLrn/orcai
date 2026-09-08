/** The app origin the stack allocated for this worktree. */
export const baseURL = (): string => {
	const value = process.env.BASE_URL;

	if (!value) {
		throw new Error(
			"BASE_URL is not set. Run the suite through `bun run stack e2e` or `bun run stack exec`.",
		);
	}

	return value;
};
