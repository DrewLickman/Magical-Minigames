import { HostGameClient } from "./HostGameClient";

export default function HostPage() {
  // #region agent log
  fetch('http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4a45cf'},body:JSON.stringify({sessionId:'4a45cf',runId:'run6',hypothesisId:'H9',location:'app/host/page.tsx:render',message:'Host page server render executed',data:{route:'/host'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return <HostGameClient templateHref="/jeopardy-template.json" />;
}
