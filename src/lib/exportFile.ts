import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function exportOrDownloadFile(
  filename: string,
  mimeType: string,
  content: string | Uint8Array
): Promise<void> {
  const bytes =
    typeof content === 'string' ? new TextEncoder().encode(content) : content;

  if (Capacitor.isNativePlatform()) {
    const base64Data = uint8ToBase64(bytes);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: 'Esporta file Siki Budget',
    });
    return;
  }

  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
