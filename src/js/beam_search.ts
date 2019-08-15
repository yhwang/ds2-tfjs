import { DEFAULT_TRIE_WEIGHT, BLANK_INDEX, CHAR_MAP } from './constants';

class LineParser {
  _payload: string;
  _index: number;
  _eof: boolean;

  constructor(payload: string) {
    this._index = 0;
    this._eof = false;
    this._payload = payload;
  }

  getLine() {
    if (this._eof) {
      return null;
    }
    const index = this._payload.indexOf('\n', this._index);
    if (index === -1) {
      this._eof = true;
      return this._payload.substring(this._index);
    }
    const rev = this._payload.substring(this._index, index);
    this._index = index + 1;
    if (this._index >= this._payload.length) {
      this._eof = true;
    }
    return rev;
  }

  getLineAsInteger() {
    return Number.parseInt(this.getLine(), 10);
  }

  getLineAsFloat() {
    return Number.parseFloat(this.getLine());
  }

  isEndOfFile() {
    return this._eof;
  }
}

class TrieNode {
  _vocabSize: number;
  _prefixCount: number;
  _minScoreWord: number;
  _minUnigramScore: number;
  _parent: TrieNode;
  children: TrieNode[];

  constructor(parent:TrieNode, vocabSize: number) {
    this._vocabSize = vocabSize;
    this._prefixCount = 0;
    this._minScoreWord = 0;
    this._minUnigramScore = Number.MAX_VALUE;
    this.children = [];
    this.children.length = vocabSize;
  }

  loadNode(lineParser: LineParser, prefixCount: number) {
    this._prefixCount = prefixCount;
    this._minScoreWord = lineParser.getLineAsInteger();
    this._minUnigramScore = lineParser.getLineAsFloat();
  }
}

interface ParseStack {
  node: TrieNode;
  index: number;
}

export class Trie {
  _url: string;
  _root: TrieNode;

  constructor(url: string, labels: number) {
    this._url = url;
    this._root = new TrieNode(null, labels);
  }

  async load() {
    await fetch(this._url)
        .then(resp => resp.arrayBuffer())
        .then((ab) => {
          const td = new TextDecoder('ascii');
          return td.decode(new Uint8Array(ab));
        })
        .then(content => {
          this._parseContent(content);
        })
        .catch((error) => {
          console.log(error);
        });
  }

  _parseContent(payload: string) {
    const parser = new LineParser(payload);

    if (parser.getLine() !== '1414678853' ||
        parser.getLine() !== '1' ||
        parser.getLine() !== `${this._root._vocabSize}`) {
      throw new Error('invalid trie format');
    }

    const parseStack: ParseStack[] = [{node:this._root, index:0}];

    // parse root node first
    const prefixCount = parser.getLineAsInteger();
    this._root.loadNode(parser, prefixCount);

    // use while and a vector(ParseStack) to parse child nodes
    // in order to avoid stack overflow
    while(!parser.isEndOfFile()) {
      if (parseStack.length === 0) {
        console.log('Some contents in the trie file are not parsed!');
        console.log(`length: ${parser._payload.length}, ${parser._index}`);
        break;
      }
      const current = parseStack[parseStack.length - 1];
      if (current.index === current.node._vocabSize) {
        parseStack.pop();
        continue;
      }

      const prefixCount = parser.getLineAsInteger();
      if(prefixCount === -1) {
        current.index = current.index + 1;
        continue;
      }

      const node = new TrieNode(current.node, current.node._vocabSize);
      node.loadNode(parser, prefixCount);
      current.node.children[current.index] = node;
      parseStack.push({node, index: 0});

      current.index = current.index + 1;
    }
  }

  get rootNode() {
    return this._root;
  }
}

// Add logarithmic probabilities using:
// ln(a + b) = ln(a) + ln(1 + exp(ln(b) - ln(a)))
const logSumExp = (log1: number, log2: number): number => {
  if (log1 === 0) {
    return log2;
  }
  if (log2 === 0) {
    return log1;
  }
  const rev = log1 > log2 ?
      log1 + Math.log1p(Math.exp(log2 - log1)):
      log2 + Math.log1p(Math.exp(log1 - log2));

  return rev;
};

/**
 * Calculate the score for BeamEntry
 *
 * @class BeamScorer
 */
class BeamScorer {
  defaultScore: number;
  weight: number;

  constructor(defaultScore: number, weight: number) {
    this.defaultScore = defaultScore;
    this.weight = weight;
  }

  getScore(state: BeamState) {
    if (state && state.trieNode) {
      return state.trieNode._minUnigramScore;
    }
    return this.defaultScore;
  }

  getWeightedScore(state: BeamState) {
    return this.weight * this.getScore(state);
  }
}

/**
 * Store the Beam entry's state
 */
interface BeamState {
  trieNode: TrieNode;
}

/**
 * Represent char index sequence and the probability
 */
class BeamEntry {
  seq: number[];
  pTotal: number;
  pBlank: number;
  pNonBlank: number;
  _last: number;
  _state: BeamState;
  _string: string;
  _parent: BeamEntry;

  constructor(seq: number[], state: BeamState, last?: number) {
    this.seq = seq;
    this.pTotal = 0;
    this.pBlank = 0;
    this.pNonBlank = 0;
    this._last = -1;
    this._state = state;
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

  // Convert char index sequence to a string
  convertToStr(): string {
    if(this._string === undefined) {
      this._string = this.seq.map((index) => {
        return CHAR_MAP.charAt(index);
      }).join('');
    }
    return this._string;
  }

  get state() {
    return this._state;
  }

  copy(row: number[], scorer: BeamScorer) {
    if (this._last === -1) {
      // leading space case has no copy case
      return undefined;
    }
    const rev = new BeamEntry(this.seq, this._state, this._last);
    // blank probability only assigned in here
    // and it is used in the extend() case 3
    if (this._parent && this._parent._last === this._last) {
      // If current sequence is abb, then copy() can be:
      // 1. ab- + - ==> ab
      // 2. abb + - ==> ab
      // 3. abb + b ==> ab
      // Therefore, use this.pTotal + blank for #1 and #2
      rev.pBlank = this.pTotal + row[BLANK_INDEX];
    } else {
      // if current sequence is acb, then copy() can be:
      // 1. acb + - ==> acb
      // 2. acb + b ==> acb
      // Therefore, use this.pNonBlank + blank for #1
      rev.pBlank = this.pNonBlank + row[BLANK_INDEX];
    }
    rev.pNonBlank = this.pNonBlank + row[this._last];
    rev.pTotal = logSumExp(rev.pNonBlank, rev.pBlank);
    rev._parent = this;
    return rev;
  }

  // Add new char and return a new BeamEntry
  extend(index: number, prob: number, pBlank: number,
      scorer: BeamScorer, nextState: Function)
      : BeamEntry {
    let pNewNonBlank = 0;
    let newSeq: number[] = [];
    let newState: BeamState;
    let pNewTotal = 0;
    let newIndex = index;
    if (this._last === -1 && index === 0) {
      // case 1:
      // leading space: merge space and blank
      // '' + (' ' and blank) ==> but still ''
      newState = this.state;
      pNewTotal = this.pTotal + logSumExp(prob, pBlank);
      newIndex = -1;
    } else if (index === this._last) {
      if (this.pBlank === 0) {
        // case 2:
        // not from copy() step and no record for the blank probability
        // no extend for this case.
        return undefined;
      } else {
        // case 3:
        // for those BeamEntry that derives from copy() step
        // the label is 'ab' but the pBlank store the probability for
        // 'ab-'. Therefore:
        // 'ab' ==> 'ab-' + 'b' ==> 'abb'
        newState = nextState(this, index);
        pNewTotal = pNewNonBlank =
            this.pBlank + logSumExp(scorer.getWeightedScore(newState), prob);
        newSeq = [...this.seq, index];
      }
    } else {
      // case 4:
      // 'ab' + 'c' ==> 'abc'
      newState = nextState(this, index);
      pNewTotal = pNewNonBlank =
          this.pTotal + logSumExp(scorer.getWeightedScore(newState), prob);
      newSeq = [...this.seq, index];
    }

    const rev = new BeamEntry(newSeq, newState, newIndex);
    rev.pNonBlank = pNewNonBlank;
    rev.pTotal = pNewTotal;
    rev._parent = this;
    return rev;
  }

  // Dump string and prob
  toString(): string {
    return `${this.convertToStr()}, (${this.pTotal})`;
  }
}

/**
 * Store the cadidated BeamEntry
 *
 * @class BeamList
 */
class BeamList {
  _size: number;
  _beams: {[label:string]: BeamEntry};
  _beamList: BeamEntry[];

  constructor(size: number) {
    this._size = size;
    this._beamList = [];
    this._beams = {};
  }

  /**
   * Add a BeamEntry into the list. If the label sequence of
   * BeamEntry already exist in the list, its probabilities
   * will be merged into existing one. Otherwise, the BeamEntry
   * will be added to the list.
   *
   * @param {BeamEntry} beam new cadidate entry
   * @returns
   * @memberof BeamList
   */
  add(beam: BeamEntry) {
    if (beam === undefined) {
      return;
    }
    const label = beam.convertToStr();
    const existing = this._beams[label];
    if (existing) {
      // merge probability
      existing.pBlank = logSumExp(beam.pBlank, existing.pBlank);
      existing.pNonBlank = logSumExp(beam.pNonBlank, existing.pNonBlank);
      existing.pTotal = logSumExp(beam.pTotal, existing.pTotal);
    } else {
      this._beams[label] = beam;
      this._beamList.push(beam);
    }
  }

  /**
   * Sort the BeamEntry in the list from high probability to low probability.
   * And the array length honors the beam width.
   *
   * @returns {BeamEntry[]}
   * @memberof BeamList
   */
  sort(): BeamEntry[] {
    const rev = this._beamList.sort((a: BeamEntry, b: BeamEntry) => {
      return b.pTotal - a.pTotal;
    });
    rev.length = this._size;
    return rev;
  }

  /**
   * Getter of beam width
   *
   * @readonly
   * @memberof BeamList
   */
  get size() {
    return this._size;
  }
}

/**
 * Wrap the Trie and Language model and provide
 * CTC decoding with language model.
 */
export class LanguageModel {
  _trie: Trie;
  _vocabSize: number;
  _loaded: boolean;
  _trieWeight: number;
  _scorer: BeamScorer;

  /**
   * Create the LanguageModel with specified trie
   * and vocabulary size.
   *
   * Note: it doesn't load the trie yet
   * @param triePath url to the trie binary
   * @param vocabSize label number
   */
  constructor(triePath: string, vocabSize: number) {
    this._vocabSize = vocabSize;
    this._trieWeight = DEFAULT_TRIE_WEIGHT;
    this._trie = new Trie(triePath, this._vocabSize);
    this._loaded = false;
    this._scorer = new BeamScorer(-100.0, this._trieWeight);
  }

  /**
   * Load Trie
   */
  async load() {
    if (!this._loaded) {
      await this._trie.load();
    }
  }

  /**
   * Run CTC decoding with language model
   * @param logPropbs time serial log probabilities
   * @param width beam width
   */
  beamSearch(logPropbs: number[][], width: number): BeamEntry[] {
    let beams: BeamEntry[] = [
        new BeamEntry([], {trieNode: this._trie.rootNode})];

    const nextState = (beam: BeamEntry, newLabel: number) => {
      if (newLabel === 0) {
        // Starting a new word
        return {trieNode: this._trie.rootNode};
      }

      if (beam.state.trieNode) {
        return {trieNode: beam.state.trieNode.children[newLabel]};
      }
      return {trieNode: undefined};
    };

    // Walk over each time step in sequence
    logPropbs.forEach((row, tIndex) => {
      const allCandidates:BeamList = new BeamList(width);
      // Expand each current candidate
      beams.forEach((beam) => {
        // calculate copy() case
        // first time slot has no copy case
        // the logic inside copy() return undefined
        allCandidates.add(beam.copy(row, this._scorer));
        // then run through all labels for the extend() case
        for(let cIndex = 0, len = row.length - 1; cIndex < len; cIndex++) {
          // extend cases
          allCandidates.add(
              beam.extend(
                  cIndex, row[cIndex], row[BLANK_INDEX],
                  this._scorer, nextState));
        }
      });

      // Order all candidates by score
      beams = allCandidates.sort();
    });
    return beams;
  }

  /**
   * Getter of Trie object
   *
   * @readonly
   * @memberof LanguageModel
   */
  get trie() {
    return this._trie;
  }
}
