/**
 * PromptMatcher
 * Ported from Bisitream (C#) & Textream (Swift)
 * Dual character-level and word-level speech alignment with anti-jump constraints.
 */

export interface AnnotationRange {
  start: number;
  end: number;
}

export class PromptMatcher {
  private static readonly AgreementThreshold = 10;
  private static readonly JumpIgnoreWindowMs = 300;

  private sourceText: string;
  private annotationRanges: AnnotationRange[];
  private _recognizedCharCount: number;
  private _rawMatchEndOffset: number = 0;
  private _matchStartOffset: number;
  private recentMatchPositions: number[] = [];
  private spokenAnchorPrefix: string = '';
  private lastJumpAt: number = 0;

  constructor(sourceText: string, startingAt = 0) {
    this.sourceText = sourceText || '';
    this.annotationRanges = PromptMatcher.extractAnnotationRanges(this.sourceText);
    const start = this.advancePastAnnotations(
      Math.max(0, Math.min(startingAt, this.sourceText.length))
    );
    this._recognizedCharCount = start;
    this._rawMatchEndOffset = start;
    this._matchStartOffset = start;
  }

  public get recognizedCharCount(): number {
    return this._recognizedCharCount;
  }

  public get rawMatchEndOffset(): number {
    return this._rawMatchEndOffset;
  }

  public get matchStartOffset(): number {
    return this._matchStartOffset;
  }

  public get unreadText(): string {
    return this._recognizedCharCount >= this.sourceText.length
      ? ''
      : this.sourceText.slice(this._recognizedCharCount);
  }

  public reset(): void {
    const start = this.advancePastAnnotations(0);
    this._recognizedCharCount = start;
    this._rawMatchEndOffset = start;
    this._matchStartOffset = start;
    this.recentMatchPositions = [];
    this.spokenAnchorPrefix = '';
    this.lastJumpAt = 0;
  }

  public restartFromCurrentProgress(): void {
    this._matchStartOffset = this._recognizedCharCount;
    this.recentMatchPositions = [];
    this.spokenAnchorPrefix = '';
  }

  public setSpokenAnchor(lastSpokenText: string): void {
    this.spokenAnchorPrefix = lastSpokenText || '';
    this.lastJumpAt = Date.now();
  }

  public jumpTo(charOffset: number): void {
    const clamped = Math.max(0, Math.min(charOffset, this.sourceText.length));
    const target = this.advancePastAnnotations(clamped);
    this._recognizedCharCount = target;
    this._rawMatchEndOffset = clamped;
    this._matchStartOffset = target;
    this.recentMatchPositions = [];
    this.lastJumpAt = Date.now();
  }

  public matchSpoken(spokenText: string, streaming = false): boolean {
    if (Date.now() - this.lastJumpAt < PromptMatcher.JumpIgnoreWindowMs) return false;
    if (!spokenText || this._matchStartOffset >= this.sourceText.length) return false;

    const spoken = this.trimAnchor(spokenText);
    if (spoken.length === 0) return false;

    const characterResult = this.charLevelMatch(spoken);
    const wordResult = this.wordLevelMatch(spoken);
    const best = PromptMatcher.bestOffset(characterResult, wordResult);
    const rawCandidate = Math.min(this._matchStartOffset + best, this.sourceText.length);
    const candidate = this.advancePastAnnotations(rawCandidate);

    if (candidate <= this._recognizedCharCount) return false;

    this.recentMatchPositions.push(candidate);
    if (this.recentMatchPositions.length > 3) {
      this.recentMatchPositions.shift();
    }

    let confirmed = false;
    if (this.recentMatchPositions.length >= 2) {
      let agreeCount = 0;
      for (const pos of this.recentMatchPositions) {
        if (Math.abs(pos - candidate) <= PromptMatcher.AgreementThreshold) {
          agreeCount++;
        }
      }
      confirmed = agreeCount >= 2;
    }

    const streamingOk = streaming && wordResult > 0 && candidate - this._recognizedCharCount <= 80;

    if (
      PromptMatcher.shouldCommit(
        characterResult,
        wordResult,
        this._recognizedCharCount,
        rawCandidate,
        candidate,
        confirmed
      ) ||
      streamingOk
    ) {
      this._rawMatchEndOffset = rawCandidate;
      this._recognizedCharCount = candidate;
      return true;
    }

    return false;
  }

  private trimAnchor(fullSpoken: string): string {
    if (!this.spokenAnchorPrefix) return fullSpoken;

    let common = 0;
    const limit = Math.min(this.spokenAnchorPrefix.length, fullSpoken.length);
    while (common < limit && this.spokenAnchorPrefix[common] === fullSpoken[common]) {
      common++;
    }

    const trimLen = Math.min(
      fullSpoken.length,
      Math.max(common, this.spokenAnchorPrefix.length - 24)
    );
    return trimLen >= fullSpoken.length ? '' : fullSpoken.slice(trimLen);
  }

  private advancePastAnnotations(offset: number): number {
    return PromptMatcher.advancePastAnnotationsStatic(
      this.sourceText,
      this.annotationRanges,
      offset
    );
  }

  private charLevelMatch(spoken: string): number {
    const remainingSource = this.sourceText.slice(this._matchStartOffset);
    const src = PromptMatcher.foldForMatch(remainingSource);
    const spk = PromptMatcher.normalize(spoken);

    let si = 0;
    let ri = 0;
    let lastGoodOrigIndex = 0;

    while (si < src.length && ri < spk.length) {
      const sc = src[si];
      const rc = spk[ri];

      if (sc === '[') {
        const closing = src.indexOf(']', si);
        if (closing >= 0) {
          si = closing + 1;
          lastGoodOrigIndex = si;
          continue;
        }
      }

      if (!PromptMatcher.isAlphanumeric(sc)) {
        si++;
        continue;
      }

      if (!PromptMatcher.isAlphanumeric(rc)) {
        ri++;
        continue;
      }

      if (sc === rc) {
        si++;
        ri++;
        lastGoodOrigIndex = si;
        continue;
      }

      let found = false;
      const maxSkipR = Math.min(5, spk.length - ri - 1);
      if (maxSkipR >= 1) {
        for (let skipR = 1; skipR <= maxSkipR; skipR++) {
          if (spk[ri + skipR] === sc) {
            ri += skipR;
            found = true;
            break;
          }
        }
      }

      if (found) continue;

      const maxSkipS = Math.min(5, src.length - si - 1);
      if (maxSkipS >= 1) {
        for (let skipS = 1; skipS <= maxSkipS; skipS++) {
          if (src[si + skipS] === rc) {
            si += skipS;
            found = true;
            break;
          }
        }
      }

      if (found) continue;
      ri++;
    }

    while (si < src.length) {
      if (src[si] === '[') {
        const closing = src.indexOf(']', si);
        if (closing >= 0) {
          si = closing + 1;
          lastGoodOrigIndex = si;
          continue;
        }
      }

      if (!PromptMatcher.isAlphanumeric(src[si])) {
        si++;
        lastGoodOrigIndex = si;
      } else {
        break;
      }
    }

    return lastGoodOrigIndex;
  }

  private wordLevelMatch(spoken: string): number {
    const remainingSource = this.sourceText.slice(this._matchStartOffset);
    const sourceWords = remainingSource.split(/\s+/).filter(Boolean);
    const spokenWords = PromptMatcher.splitIntoWords(spoken);

    let si = 0;
    let ri = 0;
    let matchedCharCount = 0;
    let isInsideAnnotation = false;

    while (si < sourceWords.length && ri < spokenWords.length) {
      const beginsAnnotation =
        sourceWords[si].startsWith('[') && sourceWords.slice(si).some((w) => w.includes(']'));
      const skipsAnnotation =
        isInsideAnnotation || beginsAnnotation || PromptMatcher.isAnnotationWord(sourceWords[si]);

      if (skipsAnnotation) {
        if (beginsAnnotation) isInsideAnnotation = true;
        if (sourceWords[si].includes(']')) isInsideAnnotation = false;
        matchedCharCount += sourceWords[si].length;
        if (si < sourceWords.length - 1) matchedCharCount += 1;
        si++;
        continue;
      }

      const srcWord = PromptMatcher.foldAlnum(sourceWords[si]);
      const spkWord = PromptMatcher.foldAlnum(spokenWords[ri]);

      if (srcWord === spkWord || PromptMatcher.isFuzzyMatch(srcWord, spkWord)) {
        matchedCharCount += sourceWords[si].length;
        si++;
        ri++;
        if (si < sourceWords.length) matchedCharCount += 1;
        continue;
      }

      let foundSpk = false;
      const maxSpkSkip = Math.min(5, spokenWords.length - ri - 1);
      if (maxSpkSkip >= 1) {
        for (let skip = 1; skip <= maxSpkSkip; skip++) {
          const nextSpk = PromptMatcher.foldAlnum(spokenWords[ri + skip]);
          if (srcWord === nextSpk || PromptMatcher.isFuzzyMatch(srcWord, nextSpk)) {
            ri += skip;
            foundSpk = true;
            break;
          }
        }
      }

      if (foundSpk) continue;

      let foundSrc = false;
      const maxSrcSkip = Math.min(5, sourceWords.length - si - 1);
      if (maxSrcSkip >= 1) {
        for (let skip = 1; skip <= maxSrcSkip; skip++) {
          const nextSrc = PromptMatcher.foldAlnum(sourceWords[si + skip]);
          if (nextSrc === spkWord || PromptMatcher.isFuzzyMatch(nextSrc, spkWord)) {
            for (let s = 0; s < skip; s++) {
              matchedCharCount += sourceWords[si + s].length + 1;
            }
            si += skip;
            foundSrc = true;
            break;
          }
        }
      }

      if (foundSrc) continue;

      if (srcWord.length === 0) {
        matchedCharCount += sourceWords[si].length;
        if (si < sourceWords.length - 1) matchedCharCount += 1;
        si++;
      } else {
        ri++;
      }
    }

    while (si < sourceWords.length) {
      const beginsAnnotation =
        sourceWords[si].startsWith('[') && sourceWords.slice(si).some((w) => w.includes(']'));
      const skipsAnnotation =
        isInsideAnnotation || beginsAnnotation || PromptMatcher.isAnnotationWord(sourceWords[si]);
      if (!skipsAnnotation) break;
      if (beginsAnnotation) isInsideAnnotation = true;
      if (sourceWords[si].includes(']')) isInsideAnnotation = false;
      matchedCharCount += sourceWords[si].length;
      if (si < sourceWords.length - 1) matchedCharCount += 1;
      si++;
    }

    return matchedCharCount;
  }

  // --- Static helpers ---

  public static isAlphanumeric(c: string): boolean {
    return /[a-zA-Z0-9\u00C0-\u024F]/.test(c);
  }

  public static isAnnotationWord(word: string): boolean {
    return (
      (word.startsWith('[') && word.endsWith(']')) ||
      !Array.from(word).some((c) => PromptMatcher.isAlphanumeric(c))
    );
  }

  public static normalize(text: string): string {
    const folded = PromptMatcher.foldForMatch(text);
    return Array.from(folded)
      .filter((c) => PromptMatcher.isAlphanumeric(c) || /\s/.test(c))
      .join('');
  }

  public static foldAlnum(word: string): string {
    const folded = PromptMatcher.foldForMatch(word);
    return Array.from(folded)
      .filter((c) => PromptMatcher.isAlphanumeric(c))
      .join('');
  }

  public static foldForMatch(text: string): string {
    const out: string[] = [];
    for (const c of text) {
      if (c === '\u0307') continue;
      out.push(PromptMatcher.foldChar(c));
    }
    return out.join('');
  }

  public static foldChar(c: string): string {
    switch (c) {
      case 'İ':
      case 'I':
      case 'ı':
      case 'i':
      case 'Î':
      case 'î':
        return 'i';
      case 'Ğ':
      case 'ğ':
        return 'g';
      case 'Ü':
      case 'ü':
      case 'Û':
      case 'û':
        return 'u';
      case 'Ş':
      case 'ş':
        return 's';
      case 'Ö':
      case 'ö':
        return 'o';
      case 'Ç':
      case 'ç':
        return 'c';
      case 'Â':
      case 'â':
        return 'a';
      default:
        return c.toLowerCase();
    }
  }

  public static isFuzzyMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;

    const shorter = Math.min(a.length, b.length);
    if (shorter >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;

    let shared = 0;
    while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
    if (shorter >= 3 && shared >= Math.max(3, Math.floor((shorter * 3) / 5))) return true;

    const dist = PromptMatcher.editDistance(a, b);
    if (shorter <= 2) return false;
    if (shorter <= 4) return dist <= 1;
    if (shorter <= 8) return dist <= 2;
    return dist <= Math.floor(Math.max(a.length, b.length) / 3);
  }

  public static editDistance(a: string, b: string): number {
    const dp: number[] = [];
    for (let j = 0; j <= b.length; j++) dp[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const temp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
        prev = temp;
      }
    }
    return dp[b.length];
  }

  public static extractAnnotationRanges(text: string): AnnotationRange[] {
    const ranges: AnnotationRange[] = [];
    let open: number | null = null;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '[' && open === null) {
        open = i;
      } else if (text[i] === ']' && open !== null) {
        ranges.push({ start: open, end: i + 1 });
        open = null;
      }
    }
    return ranges;
  }

  public static advancePastAnnotationsStatic(
    text: string,
    ranges: AnnotationRange[],
    offset: number
  ): number {
    let current = Math.max(0, Math.min(offset, text.length));
    let skipped = false;

    while (current < text.length) {
      const hit = ranges.find((r) => r.start <= current && current < r.end);
      if (hit && hit.end > 0) {
        current = hit.end;
        skipped = true;
        continue;
      }

      let next = current;
      while (next < text.length && /\s/.test(text[next])) next++;

      const adj = ranges.find((r) => r.start === next);
      if (adj && adj.end > 0) {
        current = adj.end;
        skipped = true;
        continue;
      }

      return skipped ? next : current;
    }

    return current;
  }

  public static bestOffset(characterResult: number, wordResult: number, tolerance = 20): number {
    if (Math.abs(characterResult - wordResult) <= tolerance) {
      return Math.floor((characterResult + wordResult) / 2);
    }
    return Math.max(characterResult, wordResult);
  }

  public static shouldCommit(
    characterResult: number,
    wordResult: number,
    current: number,
    rawCandidate: number,
    candidate: number,
    confirmed: boolean
  ): boolean {
    if (candidate <= current) return false;

    const bothProgressed = Math.min(characterResult, wordResult) > 0;
    const skippedAnnotation = candidate > rawCandidate;
    const smallStep = candidate - current <= 15;
    return bothProgressed || skippedAnnotation || confirmed || smallStep;
  }

  public static splitIntoWords(text: string): string[] {
    if (!text || !text.trim()) return [];
    return text.trim().split(/\s+/).filter(Boolean);
  }
}

