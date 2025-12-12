
import JSZip from 'jszip';
import { Role } from './types';

export async function exportRole(role: Role): Promise<void> {
  const zip = new JSZip();

  zip.file('manifest.json', JSON.stringify(role.manifest, null, 2));
  zip.file('prompt.md', role.systemPrompt);

  for (const helper of role.helpers) {
    zip.file(`helpers/${helper.filename}`, helper.source);
  }

  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${role.manifest.id}.role`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
