/**
 * Core LCS-based line diff.
 *
 * The approach is the textbook Hunt-McIlroy pipeline:
 *   1. Find the LCS of the two line arrays (dynamic programming table).
 *   2. Walk the table to emit one of three operations per step: equal, delete
 *      (line only in the old document), or insert (line only in the new).
 *
 * We compare lines by strict equality (===). No normalisation, no trimming, no
 * case-folding. If a caller wants case-insensitive or whitespace-insensitive
 * diffing they can pre-map the inputs; keeping this layer literal means the
 * diff is always reversible and the output never lies about what changed.
 */

/**
 * @enum {string}
 * The kind of edit operation produced by diff().
 */
export const DiffOp = Object.freeze({
  /** A line present in both documents at this point in the alignment. */
  EQUAL: 'equal',
  /** A line present only in the old document; it was removed. */
  DELETE: 'delete',
  /** A line present only in the new document; it was added. */
  INSERT: 'insert',
});

/**
 * @typedef {Object} DiffEntry
 * @property {string} type  One of DiffOp.
 * @property {string} line  The line text (without trailing newline).
 * @property {number} oldNo 1-based line number in the old document, or -1 for inserts.
 * @property {number} newNo 1-based line number in the new document, or -1 for deletes.
 */

/**
 * Split a document string into an array of lines, preserving every line and
 * dropping the trailing newline of each. A trailing newline at end of document
 * does NOT produce a phantom empty final line: "a\n" -> ["a"], "a\nb\n" ->
 * ["a","b"]. An empty string produces []. This matches how most editors count
 * lines and avoids spurious diffs on files that do or don't end in a newline.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitLines(text) {
  if (text === '') return [];
  // String.prototype.split with a trailing separator would yield a trailing '';
  // trim it so "a\n" and "a" are identical.
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/**
 * Compute the longest common subsequence of two line arrays as a list of
 * [oldIndex, newIndex] pairs (0-based). The returned pairs are in ascending
 * order by both indices.
 *
 * Uses the standard DP table where dp[i][j] is the LCS length of
 * oldLines[0..i) and newLines[0..j). We then backtrack to recover the pairs.
 * Space is O(n*m); for very large inputs a Hirschberg variant would be better,
 * but document-sized diffs fit comfortably.
 *
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @returns {Array<[number, number]>}
 */
export function lcs(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = LCS length of oldLines[0..i) and newLines[0..j).
  // Using Int32Array rows for cache efficiency on larger inputs.
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    dp[i] = new Int32Array(m + 1);
  }

  for (let i = 1; i <= n; i++) {
    const oi = oldLines[i - 1];
    const prev = dp[i - 1];
    const cur = dp[i];
    for (let j = 1; j <= m; j++) {
      if (oi === newLines[j - 1]) {
        cur[j] = prev[j - 1] + 1;
      } else {
        const up = prev[j];
        const left = cur[j - 1];
        cur[j] = up >= left ? up : left;
      }
    }
  }

  // Backtrack to recover the matching pairs.
  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

/**
 * Produce a line-level diff between two documents.
 *
 * @param {string} oldText The original document.
 * @param {string} newText The modified document.
 * @returns {DiffEntry[]} Ordered list of edit operations. Concatenating the
 *   `line` fields of the EQUAL and INSERT entries reproduces newText; the EQUAL
 *   and DELETE entries reproduce oldText.
 */
export function diff(oldText, newText) {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const pairs = lcs(oldLines, newLines);

  const ops = [];
  let oi = 0; // cursor into oldLines
  let ni = 0; // cursor into newLines
  let oldNo = 1; // 1-based line numbers for output
  let newNo = 1;

  for (const [pi, pj] of pairs) {
    // Lines in old before this match: deletions.
    while (oi < pi) {
      ops.push({ type: DiffOp.DELETE, line: oldLines[oi], oldNo, newNo: -1 });
      oi++;
      oldNo++;
    }
    // Lines in new before this match: insertions.
    while (ni < pj) {
      ops.push({ type: DiffOp.INSERT, line: newLines[ni], oldNo: -1, newNo });
      ni++;
      newNo++;
    }
    // The matched line itself.
    ops.push({ type: DiffOp.EQUAL, line: oldLines[pi], oldNo, newNo });
    oi++;
    ni++;
    oldNo++;
    newNo++;
  }

  // Trailing deletions and insertions after the last match.
  while (oi < oldLines.length) {
    ops.push({ type: DiffOp.DELETE, line: oldLines[oi], oldNo, newNo: -1 });
    oi++;
    oldNo++;
  }
  while (ni < newLines.length) {
    ops.push({ type: DiffOp.INSERT, line: newLines[ni], oldNo: -1, newNo });
    ni++;
    newNo++;
  }

  return ops;
}
