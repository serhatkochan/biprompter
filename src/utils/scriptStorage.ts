import type { ScriptData, ScriptSection } from '../types/prompter';
import { DEMO_SCRIPT } from '../types/prompter';

const SCRIPTS_STORAGE_KEY = 'biprompter_scripts_library_v1';
const ACTIVE_SCRIPT_ID_KEY = 'biprompter_active_script_id';

/**
 * Ensures a script has a valid `sections` array and `activeSectionId`.
 * Migrates old monolithic content (or markdown # headings) into individual sections.
 */
export function ensureScriptSections(script: any): ScriptData {
  let sections: ScriptSection[] = [];

  if (Array.isArray(script.sections) && script.sections.length > 0) {
    sections = script.sections.map((sec: any, idx: number) => ({
      id: sec.id || `sec-${idx + 1}-${Date.now()}`,
      title: sec.title || `Bölüm ${idx + 1}`,
      content: typeof sec.content === 'string' ? sec.content : '',
      updatedAt: sec.updatedAt || script.updatedAt || Date.now(),
    }));
  } else if (typeof script.content === 'string' && script.content.trim()) {
    // If the old script had `#` heading lines, split them into distinct sections!
    const lines = script.content.split('\n');
    let currentTitle = 'Bölüm 1';
    let currentLines: string[] = [];
    let sectionIdx = 1;

    for (const line of lines) {
      const match = line.match(/^#{1,3}\s+(.+)$/);
      if (match) {
        if (currentLines.length > 0 || sectionIdx > 1) {
          sections.push({
            id: `sec-${sectionIdx++}-${Date.now()}`,
            title: currentTitle,
            content: currentLines.join('\n').trim(),
            updatedAt: script.updatedAt || Date.now(),
          });
          currentLines = [];
        }
        currentTitle = match[1].trim();
      } else {
        currentLines.push(line);
      }
    }

    sections.push({
      id: `sec-${sectionIdx++}-${Date.now()}`,
      title: currentTitle,
      content: currentLines.join('\n').trim(),
      updatedAt: script.updatedAt || Date.now(),
    });

    // Remove empty dummy first section if second section already has content
    if (sections.length > 1 && sections[0].title === 'Bölüm 1' && !sections[0].content) {
      sections.shift();
    }
  }

  if (sections.length === 0) {
    sections = [
      {
        id: `sec-1-${Date.now()}`,
        title: 'Bölüm 1',
        content: typeof script.content === 'string' ? script.content : '',
        updatedAt: script.updatedAt || Date.now(),
      },
    ];
  }

  const activeSectionId =
    script.activeSectionId && sections.some((s) => s.id === script.activeSectionId)
      ? script.activeSectionId
      : sections[0].id;

  return {
    ...script,
    sections,
    activeSectionId,
    content: sections.map((s) => s.content).join('\n\n'),
  };
}

/**
 * Loads all saved scripts from localStorage.
 * Automatically migrates single script if existing.
 */
export function loadAllScripts(): ScriptData[] {
  if (typeof window === 'undefined') {
    return [DEMO_SCRIPT];
  }

  try {
    const raw = localStorage.getItem(SCRIPTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(ensureScriptSections);
      }
    }

    // Migration from old single script key
    const oldCurrent = localStorage.getItem('biprompter_current_script');
    if (oldCurrent) {
      const parsedOld = JSON.parse(oldCurrent);
      if (parsedOld && parsedOld.content) {
        const initial = [ensureScriptSections(parsedOld)];
        saveAllScripts(initial);
        setActiveScriptId(parsedOld.id);
        return initial;
      }
    }

    // Default to demo script
    const initial = [DEMO_SCRIPT];
    saveAllScripts(initial);
    setActiveScriptId(DEMO_SCRIPT.id);
    return initial;
  } catch (err) {
    console.warn('Error loading scripts from storage:', err);
    return [DEMO_SCRIPT];
  }
}

/**
 * Saves all scripts list to localStorage.
 */
export function saveAllScripts(scripts: ScriptData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
  } catch (err) {
    console.error('Failed to save scripts to storage:', err);
  }
}

export function getActiveScriptId(): string {
  if (typeof window === 'undefined') return DEMO_SCRIPT.id;
  return localStorage.getItem(ACTIVE_SCRIPT_ID_KEY) || DEMO_SCRIPT.id;
}

export function setActiveScriptId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SCRIPT_ID_KEY, id);
}

/**
 * Creates a brand new script and appends it to storage.
 */
export function createNewScript(title = 'Yeni Konuşma', content = ''): ScriptData {
  const secId = `sec-${Date.now()}`;
  const newScript: ScriptData = {
    id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title,
    activeSectionId: secId,
    sections: [
      {
        id: secId,
        title: 'Bölüm 1',
        content,
        updatedAt: Date.now(),
      },
    ],
    content,
    updatedAt: Date.now(),
  };

  const scripts = loadAllScripts();
  const updated = [newScript, ...scripts];
  saveAllScripts(updated);
  setActiveScriptId(newScript.id);

  return newScript;
}

/**
 * Duplicates an existing script.
 */
export function duplicateScript(id: string): ScriptData | null {
  const scripts = loadAllScripts();
  const target = scripts.find((s) => s.id === id);
  if (!target) return null;

  const targetSections = (target.sections || []).map((sec, idx) => ({
    ...sec,
    id: `sec-${idx + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    updatedAt: Date.now(),
  }));

  const copy: ScriptData = {
    ...target,
    id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: `${target.title} (Kopya)`,
    sections: targetSections,
    activeSectionId: targetSections[0]?.id,
    updatedAt: Date.now(),
  };

  const updated = [copy, ...scripts];
  saveAllScripts(updated);
  setActiveScriptId(copy.id);
  return copy;
}

/**
 * Deletes a script by ID. Ensures at least one script remains.
 */
export function deleteScript(id: string): ScriptData[] {
  const scripts = loadAllScripts();
  const filtered = scripts.filter((s) => s.id !== id);

  if (filtered.length === 0) {
    // Keep at least one empty script
    const secId = `sec-${Date.now()}`;
    const empty: ScriptData = {
      id: `script-${Date.now()}`,
      title: 'Yeni Konuşma',
      activeSectionId: secId,
      sections: [
        {
          id: secId,
          title: 'Bölüm 1',
          content: '',
          updatedAt: Date.now(),
        },
      ],
      content: '',
      updatedAt: Date.now(),
    };
    filtered.push(empty);
  }

  saveAllScripts(filtered);
  const currentActive = getActiveScriptId();
  if (currentActive === id) {
    setActiveScriptId(filtered[0].id);
  }

  return filtered;
}

/**
 * Export script content as a plain text file (.txt).
 */
export function exportScriptAsTxt(script: ScriptData): void {
  const textContent =
    script.sections && script.sections.length > 0
      ? script.sections.map((s) => `${s.title}\n\n${s.content}`).join('\n\n---\n\n')
      : script.content || '';
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(script.title || 'konusma-metni').replace(/[^\w\s-]/gi, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export script as JSON with full metadata.
 */
export function exportScriptAsJson(script: ScriptData): void {
  const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(script.title || 'konusma-metni').replace(/[^\w\s-]/gi, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read text content from an uploaded File (.txt, .md, .json).
 */
export async function parseImportedFile(file: File): Promise<{ title: string; content: string }> {
  const rawText = await file.text();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  if (file.name.endsWith('.json')) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.content) {
        return {
          title: parsed.title || baseName,
          content: parsed.content,
        };
      }
    } catch {}
  }

  return {
    title: baseName,
    content: rawText,
  };
}

/**
 * Formats timestamp to a concise time-ago string like in Antigravity (e.g. 18m, 24h, 6d)
 */
export function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '1m';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 30) return `${diffDay}d`;
  return `${Math.floor(diffDay / 30)}mo`;
}
