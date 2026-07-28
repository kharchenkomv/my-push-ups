import { Platform } from "react-native";

import { dateKey } from "./core";

// ============================================================================
// Backup files.
//
// Export writes a real `.json` file and hands it to the system share sheet
// (native) or downloads it (web); import reads one back. Both sides speak the
// same format — whatever `exportJson()` produced — so a backup round-trips.
// ============================================================================

const MIME = "application/json";

export function backupFilename(): string {
  return `my-trainer-backup-${dateKey()}.json`;
}

/** Save/share the backup as a file. Returns false if the user cancelled. */
export async function exportBackupFile(json: string): Promise<boolean> {
  const name = backupFilename();

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([json], { type: MIME }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick — Safari needs the URL alive during the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  // The cache directory is the right home for a transient share payload; the
  // system reclaims it, and the user's copy lives wherever they save it.
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: MIME,
    dialogTitle: "Export backup",
    UTI: "public.json",
  });
  return true;
}

/**
 * Let the user pick a backup file and return its contents.
 * Returns null if they cancelled.
 */
export async function pickBackupFile(): Promise<string | null> {
  const DocumentPicker = await import("expo-document-picker");

  const result = await DocumentPicker.getDocumentAsync({
    // Some pickers/providers hand JSON back as octet-stream or text/plain, so
    // accept broadly and let the parser be the real gate.
    type: Platform.OS === "web" ? MIME : ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;

  // Web hands back a real File object; reading it directly avoids a fetch of
  // the blob: URL, which some browsers refuse under a strict CSP.
  const picked = (asset as { file?: File }).file;
  if (picked && typeof picked.text === "function") {
    return picked.text();
  }

  if (Platform.OS === "web") {
    const res = await fetch(asset.uri);
    return res.text();
  }

  const { File: FsFile } = await import("expo-file-system");
  return new FsFile(asset.uri).text();
}
