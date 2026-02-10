import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
    }

    const name = (file as File).name || 'unknown';
    const ext = name.split('.').pop()?.toLowerCase() || '';

    let text = '';
    let metadata: Record<string, unknown> | undefined;

    switch (ext) {
      case 'pdf': {
        const { PDFParse } = await import('pdf-parse');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = new PDFParse({ data: new Uint8Array(arrayBuffer) });
        const [textResult, infoResult] = await Promise.all([
          pdf.getText(),
          pdf.getInfo().catch(() => null),
        ]);
        text = textResult.text;
        metadata = {
          pages: textResult.total,
          title: infoResult?.info?.Title || undefined,
          author: infoResult?.info?.Author || undefined,
        };
        await pdf.destroy();
        break;
      }
      case 'docx': {
        const mammoth = await import('mammoth');
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        break;
      }
      case 'xlsx':
      case 'xls': {
        const XLSX = await import('xlsx');
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const parts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          parts.push(`--- Sheet: ${sheetName} ---`);
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
          for (const row of rows) {
            if (Array.isArray(row)) {
              parts.push(row.map(cell => cell ?? '').join('\t'));
            }
          }
        }
        text = parts.join('\n');
        metadata = { sheets: workbook.SheetNames };
        break;
      }
      default:
        return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No text content could be extracted' }, { status: 400 });
    }

    return NextResponse.json({ text, metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Parse API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
