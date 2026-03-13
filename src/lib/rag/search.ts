/**
 * RAG search scoring: vector and hybrid (vector + BM25).
 */

import { RAGChunk, RAGSearchResult } from './types';

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  mode?: 'vector' | 'hybrid';
  hybridAlpha?: number;
  bm25K1?: number;
  bm25B?: number;
  queryText?: string;
}

interface ScoredCandidate extends RAGSearchResult {
  documentId: string;
  embedding: number[];
}

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:[_./:-][\p{L}\p{N}]+)*/gu;
const COMPOUND_TOKEN_SPLIT_PATTERN = /[_./:-]+/g;

/**
 * Cosine similarity between two vectors
 * OpenAI embeddings are normalized, so this is just dot product
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function tokenizeForBM25(text: string): string[] {
  const normalized = text.normalize('NFKC').toLowerCase();
  const matches = normalized.match(TOKEN_PATTERN);
  if (!matches) return [];

  const tokens: string[] = [];
  for (const match of matches) {
    if (match.length >= 2) {
      tokens.push(match);
    }

    if (match.includes('-') || match.includes('_') || match.includes('.') || match.includes('/') || match.includes(':')) {
      for (const part of match.split(COMPOUND_TOKEN_SPLIT_PATTERN)) {
        if (part.length >= 2) {
          tokens.push(part);
        }
      }
    }
  }

  return tokens;
}

function termFrequencies(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }
  return tf;
}

function computeBM25Scores(
  queryText: string,
  chunks: RAGChunk[],
  k1: number,
  b: number
): number[] {
  const queryTerms = tokenizeForBM25(queryText);
  if (queryTerms.length === 0 || chunks.length === 0) {
    return new Array(chunks.length).fill(0);
  }

  const docsTerms = chunks.map((chunk) => tokenizeForBM25(chunk.content));
  const avgDl = docsTerms.reduce((sum, terms) => sum + terms.length, 0) / Math.max(docsTerms.length, 1);
  const N = docsTerms.length;

  const df = new Map<string, number>();
  for (const terms of docsTerms) {
    const unique = new Set(terms);
    for (const term of unique) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  return docsTerms.map((terms) => {
    if (terms.length === 0) return 0;
    const tf = termFrequencies(terms);
    const dl = terms.length;
    let score = 0;

    for (const term of queryTerms) {
      const freq = tf.get(term) || 0;
      if (freq === 0) continue;

      const docFreq = df.get(term) || 0;
      const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
      const numerator = freq * (k1 + 1);
      const denominator = freq + k1 * (1 - b + b * (dl / Math.max(avgDl, 1)));
      score += idf * (numerator / Math.max(denominator, 1e-9));
    }

    return score;
  });
}

function diversifyResults(
  candidates: ScoredCandidate[],
  limit: number,
  lambda = 0.85
): ScoredCandidate[] {
  if (candidates.length <= 1 || limit <= 1) {
    return candidates.slice(0, limit);
  }

  const remaining = [...candidates];
  const selected: ScoredCandidate[] = [];

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const redundancy = selected.length === 0
        ? 0
        : selected.reduce((maxRedundancy, selectedCandidate) => (
          Math.max(maxRedundancy, Math.max(0, cosineSimilarity(candidate.embedding, selectedCandidate.embedding)))
        ), 0);

      // MMR keeps the highest-signal chunks while reducing near-duplicate neighbors.
      const mmrScore = (lambda * candidate.score) - ((1 - lambda) * redundancy);
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected.sort((a, b) => b.score - a.score || a.position - b.position);
}

/**
 * Search chunks by cosine similarity to query embedding
 */
export function searchChunks(
  queryEmbedding: number[],
  chunks: RAGChunk[],
  documentNames: Map<string, string>,
  options?: SearchOptions
): RAGSearchResult[] {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? 0.3;
  const mode = options?.mode ?? 'vector';
  const alpha = clamp(options?.hybridAlpha ?? 0.75, 0, 1);
  const k1 = options?.bm25K1 ?? 1.2;
  const b = options?.bm25B ?? 0.75;

  const semanticScores = chunks.map((chunk) => cosineSimilarity(queryEmbedding, chunk.embedding));

  let lexicalScores = new Array(chunks.length).fill(0);
  let hasLexicalSignal = false;
  if (mode === 'hybrid') {
    lexicalScores = computeBM25Scores(options?.queryText || '', chunks, k1, b);
    const maxLexical = Math.max(...lexicalScores, 0);
    if (maxLexical > 0) {
      hasLexicalSignal = true;
      lexicalScores = lexicalScores.map((score) => score / maxLexical);
    }
  }

  const scored = chunks.map((chunk, i) => {
    const semanticScore = Math.max(0, semanticScores[i]);
    const lexicalScore = mode === 'hybrid' && hasLexicalSignal ? lexicalScores[i] : 0;
    // If the lexical side contributes no signal, fall back to semantic-only scoring.
    const combinedScore = mode === 'hybrid' && hasLexicalSignal
      ? alpha * semanticScore + (1 - alpha) * lexicalScore
      : semanticScore;

    return {
      documentId: chunk.documentId,
      embedding: chunk.embedding,
      documentName: documentNames.get(chunk.documentId) || 'Unknown',
      chunkContent: chunk.content,
      position: chunk.position,
      score: combinedScore,
      semanticScore,
      lexicalScore: mode === 'hybrid' && hasLexicalSignal ? lexicalScore : undefined,
    };
  });

  const shortlisted = scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit * 4, limit));

  return diversifyResults(shortlisted, limit).map((candidate) => ({
    documentName: candidate.documentName,
    chunkContent: candidate.chunkContent,
    position: candidate.position,
    score: candidate.score,
    semanticScore: candidate.semanticScore,
    lexicalScore: candidate.lexicalScore,
  }));
}
