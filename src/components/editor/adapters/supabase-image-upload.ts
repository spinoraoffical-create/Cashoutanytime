export type ImageUploadAction = (
  formData: FormData
) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

/**
 * Wraps a project's own server action (FormData in, {ok,url}/{ok,error} out)
 * into the plain `(file) => Promise<string>` shape RichContentEditor expects —
 * keeps the editor core free of any Supabase-specific imports.
 */
export function createImageUploadAdapter(action: ImageUploadAction) {
  return async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await action(formData);
    if (!result.ok) throw new Error(result.error);
    return result.url;
  };
}
