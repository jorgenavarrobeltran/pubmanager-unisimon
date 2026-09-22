/**
 * Certificate generator using docxtemplater.
 * Loads a .docx template from /public/templates/, replaces placeholders with
 * provided data, and returns a Blob for download.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { getTemplateById, type TemplateConfig } from './certificateTemplateMap';

/**
 * Generate a certificate .docx file from a template and data.
 * @param templateId - The template configuration ID
 * @param data - Key-value pairs matching the template's placeholder fields
 * @returns Promise that resolves when the file is downloaded
 */
export async function generateCertificate(
  templateId: string,
  data: Record<string, any>
): Promise<{ success: boolean; fileName: string; error?: string }> {
  const template = getTemplateById(templateId);
  if (!template) {
    return { success: false, fileName: '', error: `Template "${templateId}" no encontrado` };
  }

  try {
    // Fetch the template file from public/templates/
    const response = await fetch(`/templates/${template.templateFile}`);
    if (!response.ok) {
      return { 
        success: false, 
        fileName: '', 
        error: `No se pudo cargar el template: ${template.templateFile}` 
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Don't throw on undefined tags — just leave them empty
      nullGetter: () => '',
    });

    // Set the data — docxtemplater will replace {key} with value
    console.log('Template data keys:', Object.keys(data));
    if (data.capitulos) {
      console.log('Capitulos count:', data.capitulos.length, 'First:', data.capitulos[0]);
    }
    doc.setData(data);

    // Render the document
    doc.render();

    // Generate the output .docx
    const output = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    });

    // Build filename: Category-Type-Date.docx
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanName = template.label.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s]/g, '').replace(/\s+/g, '-');
    const recipientName = (data.nombre_autor || data.autores || '').split(',')[0].trim().replace(/\s+/g, '-');
    const fileName = `${cleanName}${recipientName ? '-' + recipientName : ''}-${dateStr}.docx`;

    // Trigger download
    saveAs(output, fileName);

    return { success: true, fileName };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error generating certificate:', error);
    return { success: false, fileName: '', error: message };
  }
}

/**
 * Get a preview of the data that will be inserted into the template.
 * Useful for showing a summary before generating.
 */
export function getCertificatePreview(
  templateId: string,
  data: Record<string, string>
): { label: string; value: string }[] {
  const template = getTemplateById(templateId);
  if (!template) return [];

  return template.fields
    .filter(field => data[field.key])
    .map(field => ({
      label: field.label,
      value: data[field.key],
    }));
}
