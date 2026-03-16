import { Spinner } from "@/components/ui/spinner";

const LoadingPage = () => {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<Spinner className="size-5" />
		</div>
	);
};

export { LoadingPage };
