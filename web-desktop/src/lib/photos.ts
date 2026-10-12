// Which dropped or picked files are photos, shared by every drop zone and picker.
// Windows can hand over a .jpg with an empty or odd type (it comes from the registry), so the extension counts
// too, and a file with no usable type is re-wrapped with the one its extension implies.

const BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg", jfif: "image/jpeg", pjpeg: "image/jpeg", pjp: "image/jpeg",
  png: "image/png", heic: "image/heic", heif: "image/heif", hif: "image/heif",
  webp: "image/webp", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
  avif: "image/avif",
};

/** For file inputs: every image type, plus the extensions some systems report without a type. */
export const PHOTO_ACCEPT = ["image/*", ...Object.keys(BY_EXT).map((e) => `.${e}`)].join(",");

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** The photos in a drop or pick; anything else is ignored. */
export function photoFiles(list: FileList | File[] | null): File[] {
  const out: File[] = [];
  for (const f of Array.from(list ?? [])) {
    const byExt = BY_EXT[extOf(f.name)];
    if (f.type.startsWith("image/")) out.push(f);
    else if (byExt && (!f.type || f.type === "application/octet-stream")) out.push(new File([f], f.name, { type: byExt, lastModified: f.lastModified }));
  }
  return out;
}
