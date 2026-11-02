import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"

export async function saveTextFile(name: string, content: string): Promise<void> {
  const file = new File(Paths.cache, name)
  file.create({ overwrite: true })
  file.write(content)
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/plain",
    UTI: "public.plain-text",
    dialogTitle: "Guardar códigos de recuperación",
  })
}
