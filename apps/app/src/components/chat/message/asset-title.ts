/** A trailing chain of file extensions, as left behind by converted uploads. */
const EXTENSION_CHAIN = /(?:\.[A-Za-z][A-Za-z0-9]{1,5})+$/;

/** The asset title without the file extensions. */
const formatAssetTitle = (title: string | undefined) => {
	const trimmed = title?.trim();

	if (!trimmed) {
		return "Source";
	}

	return trimmed.replace(EXTENSION_CHAIN, "") || trimmed;
};

export { formatAssetTitle };
