import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { validateCSRF } from '@/lib/mcp/server-config';

export const dynamic = 'force-dynamic';
const MAX_IMPORT_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_DB_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3']);
const SQLITE_IMPORT_ALLOWED_ROOTS = [
  path.resolve(process.cwd()),
  path.resolve(os.tmpdir()),
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');

function sanitizeName(name: string, fallback: string): string {
  const s = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^\d/.test(s) ? `_${s}` : s || fallback;
}

function inferType(values: unknown[]): 'INTEGER' | 'REAL' | 'TEXT' {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'TEXT';
  if (nonNull.every(v => typeof v === 'number' && Number.isInteger(v))) return 'INTEGER';
  if (nonNull.every(v => typeof v === 'number')) return 'REAL';
  return 'TEXT';
}

function toSqliteValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isWithinAllowedRoot(targetPath: string): boolean {
  return SQLITE_IMPORT_ALLOWED_ROOTS.some((root) => (
    targetPath === root || targetPath.startsWith(root + path.sep)
  ));
}

function isOutputPathAllowed(outputPath: string): boolean {
  const normalizedOutput = path.resolve(outputPath);
  if (!isWithinAllowedRoot(normalizedOutput)) {
    return false;
  }

  if (fs.existsSync(normalizedOutput)) {
    try {
      const existingTarget = fs.lstatSync(normalizedOutput);
      if (existingTarget.isSymbolicLink()) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const parentDir = path.dirname(normalizedOutput);
  try {
    fs.mkdirSync(parentDir, { recursive: true });
    const resolvedParent = fs.realpathSync(parentDir);
    return isWithinAllowedRoot(resolvedParent);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const outputPath = (formData.get('outputPath') as string | null)?.trim();

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 });
  }
  if (!outputPath) return NextResponse.json({ error: 'No output path provided' }, { status: 400 });
  if (!path.isAbsolute(outputPath)) {
    return NextResponse.json({ error: 'Output path must be absolute (e.g. /home/user/data.db)' }, { status: 400 });
  }
  if (!ALLOWED_DB_EXTENSIONS.has(path.extname(outputPath).toLowerCase())) {
    return NextResponse.json(
      { error: 'Output path must end with .db, .sqlite, or .sqlite3' },
      { status: 400 }
    );
  }
  if (!isOutputPathAllowed(outputPath)) {
    return NextResponse.json(
      {
        error: `Output path must stay within ${SQLITE_IMPORT_ALLOWED_ROOTS.join(' or ')}`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let db: import('better-sqlite3').Database | null = null;

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    db = new BetterSqlite3(path.resolve(outputPath));

    const results: { tableName: string; rowCount: number; columns: number }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: true,
      });

      if (rows.length === 0) continue;

      const origCols = Object.keys(rows[0]);
      if (origCols.length === 0) continue;

      const tableName = sanitizeName(sheetName, `sheet_${results.length + 1}`);

      // Infer column types from data
      const colTypes = origCols.map(col => inferType(rows.map(r => r[col])));

      // Build quoted column definitions
      const colDefs = origCols
        .map((col, i) => `"${col.replace(/"/g, '""')}" ${colTypes[i]}`)
        .join(', ');

      db.exec(`DROP TABLE IF EXISTS "${tableName.replace(/"/g, '""')}"`);
      db.exec(`CREATE TABLE "${tableName.replace(/"/g, '""')}" (${colDefs})`);

      const quotedCols = origCols.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');
      const placeholders = origCols.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT INTO "${tableName.replace(/"/g, '""')}" (${quotedCols}) VALUES (${placeholders})`
      );

      const insertAll = db.transaction((data: Record<string, unknown>[]) => {
        for (const row of data) {
          stmt.run(origCols.map(col => toSqliteValue(row[col])));
        }
      });

      insertAll(rows);
      results.push({ tableName, rowCount: rows.length, columns: origCols.length });
    }

    return NextResponse.json({ success: true, outputPath, tables: results });
  } catch (err) {
    return NextResponse.json(
      { error: `Conversion failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  } finally {
    try {
      db?.close();
    } catch {
      // Ignore close failures during error handling
    }
  }
}
