const fs = require('fs');
const ts = require('typescript');
const text = fs.readFileSync('src/components/NpcVendorSettingsDialog.tsx', 'utf8');
const sf = ts.createSourceFile('NpcVendorSettingsDialog.tsx', text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
console.log(sf.parseDiagnostics.map(d => ({
  code: d.code,
  message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
  line: d.file ? d.file.getLineAndCharacterOfPosition(d.start).line+1 : null,
  character: d.file ? d.file.getLineAndCharacterOfPosition(d.start).character+1 : null,
  start: d.start,
  length: d.length
})));
