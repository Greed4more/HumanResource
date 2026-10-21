import { createFileRoute } from "@tanstack/react-router";
import { InformationPage, getPageInfo } from "@/components/afterclass/pages";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const page = getPageInfo("privacy");
    return pageMetadata(page.title, page.description);
  },
  component: () => <InformationPage kind="privacy" />,
});
