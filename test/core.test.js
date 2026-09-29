import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diff, lcs, DiffOp } from '../src/index.js';

/** Reconstruct a document from the diff ops by keeping EQUAL and INSERT lines. */
function reconstructNew(ops) {
  return ops
    .filter((o) => o.type === DiffOp.EQUAL || o.type === DiffOp.INSERT)
    .map((o) => o.line)
    .join('\n');
}

/** Reconstruct a document from the diff ops by keeping EQUAL and DELETE lines. */
function reconstructOld(ops) {
  return ops
    .filter((o) => o.type === DiffOp.EQUAL || o.type === DiffOp.DELETE)
    .map((o) => o.line)
    .join('\n');
}

test('identical documents produce only EQUAL ops', () => {
  const text = 'alpha\nbeta\ngamma';
  const ops = diff(text, text);
  assert.deepEqual(
    ops.map((o) => o.type),
    [DiffOp.EQUAL, DiffOp.EQUAL, DiffOp.EQUAL],
  );
  assert.deepEqual(ops.map((o) => o.line), ['alpha', 'beta', 'gamma']);
});

test('empty to empty produces no ops', () => {
  assert.deepEqual(diff('', ''), []);
});

test('empty old document is all inserts', () => {
  const ops = diff('', 'a\nb');
  assert.deepEqual(ops.map((o) => o.type), [DiffOp.INSERT, DiffOp.INSERT]);
  assert.equal(reconstructNew(ops), 'a\nb');
});

test('empty new document is all deletes', () => {
  const ops = diff('a\nb', '');
  assert.deepEqual(ops.map((o) => o.type), [DiffOp.DELETE, DiffOp.DELETE]);
  assert.equal(reconstructOld(ops), 'a\nb');
});

test('pure insertion at end', () => {
  const ops = diff('a\nb', 'a\nb\nc');
  assert.deepEqual(
    ops.map((o) => o.type),
    [DiffOp.EQUAL, DiffOp.EQUAL, DiffOp.INSERT],
  );
  assert.equal(ops[2].line, 'c');
});

test('pure deletion at end', () => {
  const ops = diff('a\nb\nc', 'a\nb');
  assert.deepEqual(
    ops.map((o) => o.type),
    [DiffOp.EQUAL, DiffOp.EQUAL, DiffOp.DELETE],
  );
  assert.equal(ops[2].line, 'c');
});

test('insertion in the middle', () => {
  const ops = diff('a\nc', 'a\nb\nc');
  assert.deepEqual(
    ops.map((o) => o.type),
    [DiffOp.EQUAL, DiffOp.INSERT, DiffOp.EQUAL],
  );
  assert.equal(ops[1].line, 'b');
});

test('deletion in the middle', () => {
  const ops = diff('a\nb\nc', 'a\nc');
  assert.deepEqual(
    ops.map((o) => o.type),
    [DiffOp.EQUAL, DiffOp.DELETE, DiffOp.EQUAL],
  );
  assert.equal(ops[1].line, 'b');
});

test('round-trip: ops reconstruct both inputs', () => {
  const oldText = 'one\ntwo\nthree\nfive';
  const newText = 'one\ntwo\nfour\nfive';
  const ops = diff(oldText, newText);
  assert.equal(reconstructOld(ops), oldText);
  assert.equal(reconstructNew(ops), newText);
});

test('trailing newline is not treated as a phantom empty line', () => {
  // "a\n" and "a" must diff to a single EQUAL, not an EQUAL plus a spurious
  // INSERT of an empty line.
  const ops = diff('a\n', 'a');
  assert.deepEqual(ops.map((o) => o.type), [DiffOp.EQUAL]);
});

test('blank lines in the middle are preserved', () => {
  const ops = diff('a\n\nb', 'a\nx\nb');
  assert.equal(reconstructOld(ops), 'a\n\nb');
  assert.equal(reconstructNew(ops), 'a\nx\nb');
});

test('line numbers are 1-based and correct', () => {
  const ops = diff('a\nb\nc', 'a\nx\nc');
  // EQUAL a (1,1), DELETE b (2,-1), INSERT x (-1,2), EQUAL c (3,3)
  assert.deepEqual(ops, [
    { type: DiffOp.EQUAL, line: 'a', oldNo: 1, newNo: 1 },
    { type: DiffOp.DELETE, line: 'b', oldNo: 2, newNo: -1 },
    { type: DiffOp.INSERT, line: 'x', oldNo: -1, newNo: 2 },
    { type: DiffOp.EQUAL, line: 'c', oldNo: 3, newNo: 3 },
  ]);
});

test('lcs returns matching index pairs in ascending order', () => {
  const pairs = lcs(['a', 'b', 'c'], ['a', 'x', 'c']);
  assert.deepEqual(pairs, [
    [0, 0],
    [2, 2],
  ]);
});

test('lcs with no common lines returns empty array', () => {
  assert.deepEqual(lcs(['a'], ['b']), []);
});

test('duplicate lines align greedily to earliest positions', () => {
  // When a line repeats, the LCS backtrack picks the earliest match, which
  // keeps the diff anchored to the top. This documents that chosen behaviour.
  const ops = diff('x\na\nx', 'a\nx');
  assert.equal(reconstructOld(ops), 'x\na\nx');
  assert.equal(reconstructNew(ops), 'a\nx');
});

test('lines are compared by strict equality, not normalised', () => {
  // "A" and "a" are different lines; no case-folding.
  const ops = diff('A', 'a');
  assert.deepEqual(ops.map((o) => o.type), [DiffOp.DELETE, DiffOp.INSERT]);
});
