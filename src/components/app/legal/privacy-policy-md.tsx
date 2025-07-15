import fs from "node:fs";
import path from "node:path";
import { Markdown } from "@/components/chat/markdown";

const PrivacyPolicyMd = async () => {
	const markdownPath = path.join(process.cwd(), "src/md/privacy-policy.md");
	const markdownContent = fs.readFileSync(markdownPath, "utf8");

	return <Markdown>{markdownContent}</Markdown>;
};

export { PrivacyPolicyMd };
