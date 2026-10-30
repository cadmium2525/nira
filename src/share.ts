export type ShareThrow = {
  distance: number;
  out: boolean;
  name: string;
};

export interface ShareResult {
  throws: ShareThrow[];
  best: number;
}

export interface PreparedResultCard {
  blob: Blob;
  url: string;
  file: File;
  text: string;
  gameUrl: string;
}

const GREEN = '#173f30';
const ORANGE = '#f15b2a';
const CREAM = '#f8f4e9';
const JAPANESE_FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

const distanceText = (value: number): string => Math.max(0, Number.isFinite(value) ? value : 0).toFixed(1);

/** Keep the GitHub Pages project path while removing debug parameters and fragments. */
export function getGameUrl(): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

export function getShareText(result: ShareResult): string {
  const hasRecord = result.throws.some((item) => !item.out);
  const record = hasRecord ? `ニラを ${distanceText(result.best)}m 飛ばした！` : 'ニラ飛ばし、くやしい2投とも場外！';
  return `${record}\n長押し＆スワイプで、目指せ最高飛距離。\n#ニラ飛ばし #NIRATHROW\n${getGameUrl()}`;
}

/** A text-only alternative: X intent does not attach the generated card image. */
export function getXShareUrl(result: ShareResult): string {
  const url = new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text', getShareText(result));
  return url.href;
}

function loadPhoto(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const photo = new Image();
    photo.onload = () => resolve(photo);
    photo.onerror = () => reject(new Error('ニラの写真を読み込めませんでした。'));
    photo.src = `${import.meta.env.BASE_URL}nira-photo.jpg`;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, family: string, weight = 600): void {
  let size = startSize;
  do {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  } while (size > 12);
}

/** Prepare this on entering the result screen, before the user presses Share. */
export async function prepareResultCard(result: ShareResult): Promise<PreparedResultCard> {
  const [photo] = await Promise.all([loadPhoto(), document.fonts?.ready ?? Promise.resolve()]);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('結果画像を作成できませんでした。');

  context.fillStyle = CREAM;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = ORANGE;
  context.fillRect(0, 0, 1200, 10);

  context.font = '700 20px Arial, sans-serif';
  context.fillStyle = ORANGE;
  context.fillText('NIRA THROW / RESULT', 64, 67);
  context.fillStyle = GREEN;
  context.font = `900 60px ${JAPANESE_FONT}`;
  context.fillText('ニラ飛ばし', 60, 150);

  context.font = '700 18px Arial, sans-serif';
  context.fillStyle = '#6e7967';
  context.fillText('BEST DISTANCE', 64, 211);

  const hasRecord = result.throws.some((item) => !item.out);
  const best = distanceText(result.best);
  if (hasRecord) {
    fitText(context, best, 520, 146, 'Arial, sans-serif', 900);
    context.fillStyle = GREEN;
    context.fillText(best, 56, 348);
    const numberWidth = context.measureText(best).width;
    context.font = '700 38px Arial, sans-serif';
    context.fillText('m', 68 + numberWidth, 346);
  } else {
    fitText(context, '記録なし', 570, 108, JAPANESE_FONT, 900);
    context.fillStyle = ORANGE;
    context.fillText('記録なし', 60, 337);
    context.font = `600 18px ${JAPANESE_FONT}`;
    context.fillStyle = '#72816d';
    context.fillText('2投とも場外。次こそ、遠くへ。', 64, 368);
  }

  context.strokeStyle = '#d7dacc';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(64, 384);
  context.lineTo(650, 384);
  context.stroke();

  result.throws.slice(0, 2).forEach((item, index) => {
    const y = 426 + index * 49;
    context.fillStyle = '#71806b';
    context.font = '700 18px Arial, sans-serif';
    context.fillText(`0${index + 1}`, 64, y);
    context.fillStyle = GREEN;
    fitText(context, item.name, 260, 22, JAPANESE_FONT);
    context.fillText(item.name, 109, y);
    context.fillStyle = item.out ? ORANGE : GREEN;
    context.font = `800 27px ${item.out ? JAPANESE_FONT : 'Arial, sans-serif'}`;
    context.textAlign = 'right';
    context.fillText(item.out ? '場外' : `${distanceText(item.distance)} m`, 650, y);
    context.textAlign = 'left';
  });

  // A real generated photograph, cropped into the right-hand inset.
  context.save();
  roundedRect(context, 725, 51, 420, 469, 25);
  context.clip();
  const scale = Math.max(420 / photo.naturalWidth, 469 / photo.naturalHeight);
  const photoWidth = photo.naturalWidth * scale;
  const photoHeight = photo.naturalHeight * scale;
  context.drawImage(photo, 725 + (420 - photoWidth) / 2, 51 + (469 - photoHeight) / 2, photoWidth, photoHeight);
  context.restore();

  context.save();
  context.translate(1109, 93);
  context.rotate(0.12);
  context.fillStyle = ORANGE;
  context.beginPath();
  context.arc(0, 0, 50, 0, Math.PI * 2);
  context.fill();
  context.textAlign = 'center';
  context.fillStyle = '#fff8e9';
  context.font = '800 15px Arial, sans-serif';
  context.fillText('LET IT', 0, -4);
  context.font = '900 22px Arial, sans-serif';
  context.fillText('FLY!', 0, 22);
  context.restore();

  context.fillStyle = GREEN;
  context.font = `700 22px ${JAPANESE_FONT}`;
  context.fillText('#ニラ飛ばし  #NIRATHROW', 64, 555);
  const gameUrl = getGameUrl();
  const displayUrl = gameUrl.replace(/^https?:\/\//, '');
  context.fillStyle = '#72816d';
  fitText(context, displayUrl, 1070, 19, 'Arial, sans-serif', 500);
  context.fillText(displayUrl, 64, 592);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('結果画像を保存できませんでした。')), 'image/png');
  });
  const file = new File([blob], `nira-throw-${hasRecord ? `${best}m` : 'no-record'}.png`, { type: 'image/png' });
  return { blob, file, url: URL.createObjectURL(blob), text: getShareText(result), gameUrl };
}

export function downloadResultCard(prepared: PreparedResultCard): void {
  const link = document.createElement('a');
  link.href = prepared.url;
  link.download = prepared.file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Call directly from a click handler so navigator.share retains user activation. */
export async function shareResultCard(prepared: PreparedResultCard): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    let canShareFile = false;
    try {
      canShareFile = navigator.canShare({ files: [prepared.file] });
    } catch {
      // File sharing is unsupported in this browser; image download remains available.
    }
    if (canShareFile) {
      try {
        const urlSuffix = `\n${prepared.gameUrl}`;
        const nativeText = prepared.text.endsWith(urlSuffix) ? prepared.text.slice(0, -urlSuffix.length) : prepared.text;
        await navigator.share({ title: 'ニラ飛ばし', text: nativeText, url: prepared.gameUrl, files: [prepared.file] });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      }
    }
  }

  downloadResultCard(prepared);
  try {
    await navigator.clipboard?.writeText(prepared.text);
  } catch {
    // Clipboard access is optional and must not prevent saving the card.
  }
  return 'downloaded';
}
