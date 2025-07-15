import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const PageTitle = () => {
	const [documentTitle, setDocumentTitle] = useState<string | undefined>(
		undefined,
	);
	const router = useRouter();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <FIXME: Check later>
	useEffect(() => {
		setDocumentTitle(document.title);
	}, [router.basepath]);

	return documentTitle ? documentTitle : <Skeleton className="h-6 w-24" />;
};

export { PageTitle };
