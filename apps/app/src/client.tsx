import { StartClient } from "@tanstack/react-start/client";
import { hydrateRoot } from "react-dom/client";
import { installZodErrorMap } from "@/lib/errors/zod-error-map";

installZodErrorMap();

hydrateRoot(document, <StartClient />);
