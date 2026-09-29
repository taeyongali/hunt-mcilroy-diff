# Hunt McIlroy Diff

Produces a line-level diff between two text documents by finding the longest common subsequence of lines. Returns an ordered list of `equal`, `delete`, and `insert` operations.

## Usage

```js
import { diff, DiffOp } from 'hunt-mcilroy-diff';

const ops = diff('alpha\nbeta\ngamma', 'alpha\ndelta\ngamma');

for (const op of ops) {
  if (op.type === DiffOp.EQUAL)  console.log('  ' + op.line);
  if (op.type === DiffOp.DELETE) console.log('- ' + op.line + '  (old line ' + op.oldNo + ')');
  if (op.type === DiffOp.INSERT) console.log('+ ' + op.line + '  (new line ' + op.newNo + ')');
}
```

Each entry has `type` (one of `DiffOp.EQUAL`, `DiffOp.DELETE`, `DiffOp.INSERT`), `line` (the text, no trailing newline), `oldNo` (1-based line in the old document, or `-1` for inserts), and `newNo` (1-based line in the new document, or `-1` for deletes).

The module also exports `lcs(oldLines, newLines)`, which returns the raw longest common subsequence as a list of `[oldIndex, newIndex]` pairs (0-based) for callers who want to build their own edit script.

## Why this exists

The problem is: given two versions of a document, show what was added and removed at line granularity. This library uses the classic dynamic-programming LCS — O(n*m) time and space — rather than a Myers diff. The trade-off is simplicity and predictable, readable output at the cost of memory on very large inputs. For document-sized text that is the right call; for multi-megabyte files you want something else.

Lines are compared by strict equality. No whitespace trimming, no case-folding, no normalisation. If you need insensitive comparison, pre-map the inputs. Keeping the core literal means the diff is always reversible: filtering the ops for `equal`+`delete` reconstructs the old text, and `equal`+`insert` reconstructs the new.

## Edge cases

- A trailing newline does not create a phantom empty final line. `"a\n"` and `"a"` are treated as one-line documents and diff to a single `equal`.
- Blank lines in the middle of a document are real lines and are preserved.
- When a line appears multiple times in both documents, the LCS backtracker anchors matches to the earliest available positions, which tends to keep the diff near the top. This is a deliberate choice, not configurable.
