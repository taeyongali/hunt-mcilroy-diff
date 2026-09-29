/**
 * Hunt-McIlroy line diff library.
 *
 * Computes a line-level diff between two documents by finding the longest
 * common subsequence (LCS) of lines, then emitting a minimal edit script of
 * insertions and deletions. The algorithm is the classic dynamic-programming
 * LCS: O(n*m) time and O(n*m) space, which is fine for the document-sized
 * inputs this library is built for. It is not a Myers diff; it does not
 * optimise for the number of edits, only for the length of the preserved
 * subsequence, which in practice produces a readable diff.
 */

export { diff, lcs, DiffOp } from './core.js';
