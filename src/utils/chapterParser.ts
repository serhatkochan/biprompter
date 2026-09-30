export interface Chapter {
  id: string;
  index: number;
  title: string;
  wordIndex: number;
  charIndex: number;
  lineIndex?: number;
  startWordIndex: number;
  startCharIndex: number;
  wordCount?: number;
}

/**
 * Extracts chapters and cue markers from script content.
 * Matches:
 * - # Heading 1 / ## Heading 2 / ### Heading 3
 * - [BÖLÜM: ...] / [Bölüm 1: ...] / [CUE: ...] / [SCENE: ...]
 * - --- or === dividers followed by a title or numbered section
 */
export function parseChapters(content: string): Chapter[] {
  if (!content || !content.trim()) {
    return [];
  }

  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  let currentWordCount = 0;
  let currentCharCount = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    // Check for chapter markers
    let chapterTitle: string | null = null;

    if (/^#{1,3}\s+(.+)$/.test(trimmed)) {
      // Markdown header: # Title
      const match = trimmed.match(/^#{1,3}\s+(.+)$/);
      if (match) chapterTitle = match[1].trim();
    } else if (/^\[(?:BÖLÜM|Bölüm|CHAPTER|Chapter|CUE|Cue|SAHNE|Sahne|PART|Part)[\s:]*([^\]]+)\]/i.test(trimmed)) {
      // Bracket cue marker: [Bölüm 1: Giriş]
      const match = trimmed.match(/^\[(?:BÖLÜM|Bölüm|CHAPTER|Chapter|CUE|Cue|SAHNE|Sahne|PART|Part)[\s:]*([^\]]+)\]/i);
      if (match) chapterTitle = match[1].trim();
    } else if (/^(?:---+|===+)\s*(.*)$/.test(trimmed) && trimmed.length >= 3) {
      // Horizontal rule divider: --- or --- Bölüm 2
      const rest = trimmed.replace(/^[=-]+\s*/, '').trim();
      chapterTitle = rest || `Bölüm ${chapters.length + 1}`;
    }

    if (chapterTitle) {
      chapters.push({
        id: `chap-${chapters.length + 1}-${lineIdx}`,
        index: chapters.length,
        title: chapterTitle,
        wordIndex: currentWordCount,
        charIndex: currentCharCount,
        lineIndex: lineIdx,
        startWordIndex: currentWordCount,
        startCharIndex: currentCharCount,
      });
    }

    // Count words and characters in this line
    const wordsInLine = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    currentWordCount += wordsInLine;
    currentCharCount += rawLine.length + 1; // +1 for newline
  }

  // If no explicit markers found and text is long (>20 words), auto-detect first section
  if (chapters.length === 0 && currentWordCount > 20) {
    chapters.push({
      id: 'chap-1-0',
      index: 0,
      title: 'Başlangıç',
      wordIndex: 0,
      charIndex: 0,
      lineIndex: 0,
      startWordIndex: 0,
      startCharIndex: 0,
    });
  }

  return chapters;
}

/**
 * Returns the active chapter given the current word index.
 */
export function getActiveChapter(chapters: Chapter[], currentWordIndex: number): Chapter | null {
  if (!chapters || chapters.length === 0) return null;

  let active = chapters[0];
  for (let i = 0; i < chapters.length; i++) {
    if (currentWordIndex >= chapters[i].wordIndex) {
      active = chapters[i];
    } else {
      break;
    }
  }
  return active;
}
