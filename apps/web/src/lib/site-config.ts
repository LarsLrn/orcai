const repository = {
	owner: "LarsLrn",
	name: "orcai",
	branch: "beta",
} as const;

export const siteConfig = {
	name: "OrcAI",
	contactEmail: "sokratest@hochschule-rhein-waal.de",
	docsPath: "/docs",
	repository: {
		...repository,
		url: `https://github.com/${repository.owner}/${repository.name}`,
	},
} as const;
