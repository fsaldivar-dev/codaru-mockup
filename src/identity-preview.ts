import type { IdentityEvidence, IdentityServiceRequest } from './contracts';
import { exportAsset } from './asset-export';

/** Browser/WebView adapter. The IDE can supply its own renderer instead. */
export async function renderIdentityEvidence(request: IdentityServiceRequest & { targetRevision: string }): Promise<IdentityEvidence[]> {
  if (!request.direction) throw new Error('Selecciona una dirección para renderizar.');
  const evidence: IdentityEvidence[] = [];
  for (const frameId of request.direction.frameIds) {
    request.signal.throwIfAborted();
    const frame = request.document.nodes.find(n => n.id === frameId);
    if (!frame) throw new Error(`Pantalla no disponible: ${frameId}`);
    const width = Math.max(1, Math.min(frame.width, 1024, 1024 * frame.width / frame.height));
    const asset = await exportAsset(request.document, { ids: [frameId], format: 'png', width });
    request.signal.throwIfAborted();
    evidence.push({ frameId, revision: request.targetRevision, dataURL: `data:image/png;base64,${asset.content}`, width: asset.files[0].width!, height: asset.files[0].height! });
  }
  return evidence;
}
