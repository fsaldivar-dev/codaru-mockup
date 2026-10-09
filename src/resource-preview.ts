import type { ResourceServices, ResourcePreview } from './contracts';

/** Browser adapter. The evaluator receives actual PNG pixels, including a small-size rendition. */
export function resourcePreviewRenderer(owner: Document): NonNullable<ResourceServices['render']> {
  return async (resource, revision) => {
    if (resource.animations?.length) throw new Error('El IDE debe proporcionar renders temporales para revisar este recurso animado.');
    const image = owner.createElement('img');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { image.src=''; reject(new Error('No se pudo preparar el render de revisión.')); }, 15000);
      image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo renderizar el dibujo.')); };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(resource.svg)}`;
    });
    const previews: ResourcePreview[] = [];
    for (const role of ['actual', 'small'] as const) {
      const side = role === 'small' ? resource.kind === 'illustration' ? 64 : 24 : 1024;
      const scale = Math.min(1, side / Math.max(resource.width,resource.height));
      const width = Math.max(1, Math.round(resource.width*scale)), height = Math.max(1, Math.round(resource.height*scale));
      const canvas = owner.createElement('canvas'); canvas.width=width; canvas.height=height;
      try {
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No está disponible el render PNG de revisión.');
        ctx.drawImage(image,0,0,width,height);
        previews.push({role,revision,width,height,dataURL:canvas.toDataURL('image/png')});
      } finally { canvas.width=canvas.height=1; }
    }
    return previews;
  };
}
