import { HostGameClient } from "./HostGameClient";

export default function HostPage() {
  const basePath =
    (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/jeopardy").replace(
      /\/$/,
      "",
    ) || "";

  return (
    <HostGameClient
      templateHref={`${basePath}/jeopardy-template.json`}
      roundTwoTemplateHref={`${basePath}/jeopardy-template-round2.json`}
      finalJeopardyTemplateHref={`${basePath}/final-jeopardy-template.json`}
    />
  );
}
