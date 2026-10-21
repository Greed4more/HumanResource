export type UploadImageOptions = {
  maxDimension: number;
  maxBytes: number;
  quality: number;
};

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

function loadWithElement(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };
    image.src = url;
  });
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> loader (older browsers / unsupported files).
    }
  }
  return loadWithElement(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function jpegName(name: string) {
  return `${name.replace(/\.[^.]+$/, "") || "image"}.jpg`;
}

/**
 * Resize/re-encode a phone photo before uploading. Large originals are the
 * usual cause of "Failed to fetch" on slow mobile connections.
 */
export async function prepareImageForUpload(
  file: File,
  options: UploadImageOptions,
): Promise<PreparedImage> {
  const keepOriginal = (width = 0, height = 0): PreparedImage => ({
    file,
    width,
    height,
  });

  let loaded: LoadedImage;
  try {
    loaded = await loadImage(file);
  } catch {
    return keepOriginal();
  }

  try {
    const { width, height } = loaded;
    if (!width || !height) return keepOriginal(width, height);

    const scale = Math.min(1, options.maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const needsResize = scale < 1;
    const needsReencode = needsResize || file.size > options.maxBytes || file.type === "image/png";

    // Keep small JPEG/WebP files exactly as they are.
    if (!needsReencode) return keepOriginal(width, height);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return keepOriginal(width, height);

    // JPEG has no alpha channel; use white rather than black for transparency.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, "image/jpeg", options.quality);
    if (!blob) return keepOriginal(width, height);

    // Never make a file larger just by re-encoding it.
    if (!needsResize && blob.size >= file.size) return keepOriginal(width, height);

    return {
      file: new File([blob], jpegName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    loaded.cleanup();
  }
}

export const PHOTO_UPLOAD_OPTIONS: UploadImageOptions = {
  maxDimension: 2000,
  maxBytes: 1_500_000,
  quality: 0.88,
};

export const ID_UPLOAD_OPTIONS: UploadImageOptions = {
  maxDimension: 2400,
  maxBytes: 3_000_000,
  quality: 0.92,
};

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
