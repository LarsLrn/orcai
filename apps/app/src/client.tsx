import { StartClient } from "@tanstack/react-start/client";
import { hydrateRoot } from "react-dom/client";
import { installZodErrorMap } from "@/lib/errors/zod-error-map";
import { installViewTransitionReadyHandler } from "@/lib/router/view-transitions";

installZodErrorMap();
installViewTransitionReadyHandler();

hydrateRoot(document, <StartClient />);
