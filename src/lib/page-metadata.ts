export function pageMetadata(title: string, description: string) {
  return {
    meta: [
      { title: `${title} · AFTERCLASS` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · AFTERCLASS` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
