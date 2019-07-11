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
    // Leading blank index or space
    if (this._last === -1 && (index === 0 || index === BLANK_INDEX) ) {
      return new SequenceProb([], newProb);
    }
    // Grouping the same character
    if (index === this._last) {
      return new SequenceProb([...this.seq], newProb, index);
    }
    // Blank index + new char case: remove blank index
    if (this._last === BLANK_INDEX && index !== BLANK_INDEX) {
      const newSeq = [...this.seq];
      newSeq.splice(this.seq.length - 1, 1, index);
      return new SequenceProb(newSeq, newProb, index);
    }
    // New char case
    return new SequenceProb([...this.seq, index], newProb, index);
  }

  // Merge SequenceProb with the same char sequence
  static merge(list: SequenceProb[]): SequenceProb[] {
    const rev: SequenceProb[] = [];
    list.forEach((one) => {
      const len = one.seq.length;
      const existing: SequenceProb = rev.find((item) => {
        if (item.seq.length === len) {
          if (item._last === one._last || len === 0) {
            return true;
          }
        }
        return false;
      });
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
        one._calculateLast();
        changed = true;
      }
    });
    if (changed) {
      return SequenceProb.merge(list);
    }
    return list;
  }

  // Convert char index sequence to a string
  convertToStr(): string {
    return this.seq.map((index) => {
      return CHAR_MAP.charAt(index);
    }).join('');
  }

  // Dump string and prob
  toString(): string {
    return `${this.convertToStr()}, (${this.prob})`;
  }
}

export function beamSearch(probs: number[][], width: number)
    : SequenceProb[] {
  let sequences: SequenceProb[] = [new SequenceProb([],1.0)];
  const lastTIndex = probs.length - 1;
  // Walk over each step in sequence
  probs.forEach( (row, tIndex) => {
    let allCandidates: SequenceProb[] = [];
    // Expand each current candidate
    sequences.forEach((seq) => {
      row.forEach((prob, cIndex) => {
        // Drop 0 prob character
        if(prob !== 0) {
          allCandidates.push(seq.append(cIndex, prob));
        }
      });
    });

    if (lastTIndex === tIndex) {
      allCandidates = SequenceProb.trimBlankIndex(allCandidates);
    } else {
      allCandidates = SequenceProb.merge(allCandidates);
    }
    // Order all candidates by score
    sequences = allCandidates.sort((a: SequenceProb, b: SequenceProb) => {
      return b.prob - a.prob;
    });
    // Select k best
    sequences.length = width;
    // Rescale the probabilities if they become too small
    if (sequences[0].prob < 0.0001) {
      const total = sequences.reduce((a,b) => a + b.prob, 0);
      sequences.forEach((seq) => seq.prob /= total);
    }
  });
  return sequences;
}
