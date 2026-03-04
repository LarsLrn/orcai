export default {
	extends: [
		"@commitlint/config-conventional",
	],
	ignores: [
		(message) => message.startsWith("Merge "),
		(message) => message.startsWith("Revert "),
	],
	rules: {
		"body-max-line-length": [
			0,
			"always",
		],
	},
};
