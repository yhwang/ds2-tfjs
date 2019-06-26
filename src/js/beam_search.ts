import { BLANK_INDEX, CHAR_MAP } from './constants';

/**
 * Represent char index sequence and the probability
 */
class SequenceProb {
  seq: number[];
  prob: number;
  _last: number;
  _candidates: SequenceProb[];

  constructor(seq: number[], prob: number, last?: number) {
    this.seq = seq;
    this.prob = prob;
    this._last = -1;
    if (last) {
      this._last = last;
    } else {
      this._calculateLast();
    }
  }

  _calculateLast() {
    if (this.seq.length > 0) {
      this._last = this.seq[this.seq.length - 1];
    }
  }

  // Add new char and return a new SequenceProb
  append(index: number, prob: number) : SequenceProb {
    const newProb = this.prob * prob;
    // leading space or blank index
    if (this._last === -1 && (index === 0 || index === BLANK_INDEX) ) {
      return new SequenceProb([], newProb);
    }
    // grouping the same character
    if (index === this._last) {
      return new SequenceProb([...this.seq], newProb, index);
    }
    // blank index + new char case: remove blank index
    if (this._last === BLANK_INDEX && index !== BLANK_INDEX) {
      const newSeq = [...this.seq];
      newSeq.splice(this.seq.length - 1, 1, index);
      return new SequenceProb(newSeq, newProb, index);
    }
    // new char case
    return new SequenceProb([...this.seq, index], newProb, index);
  }

  // Merge SequenceProb with the same char sequence
  static merge(list: SequenceProb[]): SequenceProb[] {
    const rev: SequenceProb[] = [];
    list.forEach((one) => {
      const len = one.seq.length;
      const existing: SequenceProb = rev.find((item) => {
        if (item.seq.length === len) {
          if (len === 0 || item._last === one._last) {
            return true;
          }
        }
        return false;
      });
      console.log(`merge: ${existing !== undefined}`);
      if (existing) {
        existing.prob = one.prob + existing.prob;
      } else {
        rev.push(one);
      }
    });
    return rev;
  }

  // Remove SequenceProb which contains trailing blank index or space
  static trimBlankIndex(list: SequenceProb[]): SequenceProb[] {
    let changed = false;
    list.forEach((one) => {
      if (one._last === BLANK_INDEX || one._last === 0) {
        one.seq.pop();
        changed = true;
      }
    });
    if (changed) {
      return this.merge(list);
    }
    return list;
  }

  // Convert char index sequence to a string
  toString(): string {
    return this.seq.map((index) => {
      return CHAR_MAP.charAt(index);
    }).join('');
  }
}

export function beamSearch(data: number[][], width: number): SequenceProb[] {
  let sequences: SequenceProb[] = [new SequenceProb([],1.0)];
  // walk over each step in sequence
    data.forEach( (row) => {
    let allCandidates: SequenceProb[] = [];
    // expand each current candidate
    sequences.forEach((seq) => {
      row.forEach((cell, index) => {
        allCandidates.push(seq.append(index, cell));
      });
    });
    allCandidates = SequenceProb.merge(allCandidates);
    // order all candidates by score
    sequences = allCandidates.sort((a: SequenceProb, b: SequenceProb) => {
      return b.prob - a.prob;
    });
    // select k best
    sequences.length = width;
  });
  return SequenceProb.trimBlankIndex(sequences);
}
