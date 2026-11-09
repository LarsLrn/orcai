import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { useIsInstanceAdmin } from "@/hooks/authz/use-instance-admin";
import { embeddingsStatusQuery } from "@/hooks/use-embeddings-configured";
import { m } from "@/paraglide/messages";

/** Tells instance admins that nothing is searchable until embeddings are set up. */
export const EmbeddingsSetupBanner = () => {
	const isInstanceAdmin = useIsInstanceAdmin();
	const { data } = useQuery({
		...embeddingsStatusQuery(),
		enabled: isInstanceAdmin,
	});

	if (!isInstanceAdmin || data?.data.configured !== false) return null;

	return (
		<div className="mx-auto w-full px-2 pt-4 md:px-6">
			<Alert>
				<TriangleAlertIcon />
				<AlertTitle>{m.embeddings_setup_banner_title()}</AlertTitle>
				<AlertDescription>
					<p>{m.embeddings_setup_banner_description()}</p>
					<Link
						to="/instance/settings"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
					>
						{m.embeddings_setup_banner_action()}
					</Link>
				</AlertDescription>
			</Alert>
		</div>
	);
};
