const LogoText = () => {
	return (
		<div className="flex w-full items-center justify-center">
			<img
				src="/logo/text_color.svg"
				alt="SokratesT Logo"
				width={150}
				height={40}
				className="h-14 w-auto dark:hidden"
			/>
			<img
				src="/logo/text_white.svg"
				alt="SokratesT Logo"
				width={150}
				height={40}
				className="hidden h-14 w-auto dark:block"
			/>
		</div>
	);
};

export { LogoText };
