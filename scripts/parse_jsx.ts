import fs from 'fs';
import path from 'path';
import parser from '@typescript-eslint/parser';

const filePath = path.resolve('src/components/ObjectManagementDialog.tsx');
const source = fs.readFileSync(filePath, 'utf8');

try {
  parser.parse(source, {
    loc: true,
    range: true,
    jsx: true,
    ecmaFeatures: { jsx: true },
    sourceType: 'module',
    ecmaVersion: 2024,
  });
  console.log('parsed ok');
} catch (err) {
  console.error(err.message);
  if (err.lineNumber !== undefined) {
    console.error('line', err.lineNumber, 'column', err.column);
  }
  process.exit(1);
}
