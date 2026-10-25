export type Html2Canvas = (element: HTMLElement, options: {
  logging: boolean; scale: number; windowWidth: number; windowHeight: number;
  onclone: (document: Document) => void;
}) => Promise<HTMLCanvasElement>;

let loading: Promise<Html2Canvas> | undefined;

async function renderer(): Promise<Html2Canvas> {
  if (window.html2canvas) return window.html2canvas;
  loading ??= new Promise<Html2Canvas>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/planner/packages/html2canvas/html2canvas.js';
    script.onload = () => {
      if (window.html2canvas) resolve(window.html2canvas);
      else { script.remove(); reject(new Error('Screenshot library did not initialize.')); }
    };
    script.onerror = () => { script.remove(); reject(new Error('Could not load the screenshot library.')); };
    document.head.appendChild(script);
  });
  try { return await loading; }
  catch (error) { loading = undefined; throw error; }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadTeamImage(element: HTMLElement, name: string, current: () => boolean): Promise<void> {
  const capture = await renderer();
  await Promise.all([...element.querySelectorAll('img')].map((image) => { image.loading = 'eager'; return image.decode(); }));
  if (!current()) throw new Error('The team changed while preparing the image. Please export again.');
  const canvas = await capture(element, {
    logging: false, windowWidth: 1200, windowHeight: 1000, scale: 1,
    onclone(clone) {
      const target = clone.getElementById(element.id);
      if (!target) throw new Error('Screenshot target could not be cloned.');
      target.style.width = '1050px';
    }
  });
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => {
    if (value) resolve(value); else reject(new Error('Could not encode the team image.'));
  }, 'image/png'));
  if (!current()) throw new Error('The team changed while creating the image. Please export again.');
  downloadBlob(blob, `${name}.png`);
}
