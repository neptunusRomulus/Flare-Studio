import { mergeEventScript, normalizeEventScriptPath, type EventScriptFile } from '@/editor/eventScripts';

export type ScriptIo = {
  readFile?: (path: string) => Promise<string | null>;
  writeFile?: (path: string, content: string) => Promise<boolean>;
};

export type ScriptWriteResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

/**
 * Writes one event script file, merging the form over whatever is already on disk so comments,
 * unrelated steps and the original ordering survive.
 */
export async function writeEventScript(args: {
  projectPath: string | null | undefined;
  scriptPath: string;
  file: EventScriptFile;
  io: ScriptIo | undefined | null;
}): Promise<ScriptWriteResult> {
  if (!args.projectPath || !args.io?.writeFile) return { ok: false, error: 'No project is open.' };
  const relative = normalizeEventScriptPath(args.scriptPath);
  const absolute = `${args.projectPath.replace(/\\/g, '/')}/${relative}`;
  const previous = (args.io.readFile ? await args.io.readFile(absolute) : '') || '';
  const content = mergeEventScript(previous, args.file);
  const written = await args.io.writeFile(absolute, content);
  if (!written) return { ok: false, error: 'Could not write the script file.' };
  return { ok: true, content };
}
