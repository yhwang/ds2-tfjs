import { DEFAULT_TRIE_WEIGHT, BLANK_INDEX, CHAR_MAP, N_GRAM_SIZE } from './constants';
import { Trie, TrieNode } from './trie_pb';

declare global {
  interface EmscriptenModule {
    addFunction?: Function;
    stringToUTF8?: Function;
  }
}

/**
 * Trie binary loader
 * @class TrieLoader
 */
class TrieLoader {
  _url: string;
  _vocabSize: number;
  _trie: Trie;
  _rootNode: TrieNode;

  constructor(url: string, labels: number) {
    this._url = url;
    this._vocabSize = labels;
  }

  load() {
    return fetch(this._url)
        .then(resp => resp.arrayBuffer())
        .then((ab) => {
          this._trie = Trie.deserializeBinary(new Uint8Array(ab));
          if (this._trie.getMagic() !== 1414678853 ||
              this._trie.getVersion() !== 1 ||
              this._trie.getVocabSize() !== this._vocabSize) {

            throw new Error('Incorrect trie format');
          }
          this._rootNode = this._trie.getRootNode();
        })
        .catch((error) => {
          console.log(error);
        });
  }

  get trie() {
    return this._trie;
  }

  get rootNode() {
    return this._rootNode;
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
 * This is used to load N-Gram binary.
 */
class NGram {
  _size: number; // gram number
  _path: string; // path for the binary
  _nGramScore: Function; // WASM function
  _defaultScore: number;

  constructor(path: string, size: number, defaultScore = -100.0) {
    this._path = path;
    this._defaultScore = defaultScore;
    this._size = size;
  }

  load() {
    return Promise.resolve(this).then((ngram) => {
      return ngram._fetchNGram();
    }).then((ngram) => {
      ngram._nGramScore =
          Module.cwrap('NGramScore',
              // return probability
              'number',
              // words ptr, word count, total word count, default score
              ['number', 'number', 'number', 'number']);
    });
  }

  _fetchNGram(): Promise<NGram> {
    return new Promise<NGram>((resolve, reject) => {
      const fetchNGram =
        Module.cwrap('FetchNGram', 'number', ['string', 'number']);
      const newFuncPtr = Module.addFunction((rev:number) => {
        if (rev === 0) {
          resolve(this);
        } else {
          reject(undefined);
        }
      }, 'vi');
      fetchNGram(this._path, newFuncPtr);
    });
  }

  /**
   * Get score for the word list
   * 
   * Based on the n-gram size, it takes the last n words
   * for scoring.
   * 
   * @param {string[]} words words list
   * @returns score for the word list
   * @memberof NGram
   */
  score(words: string[]) {
    if (this._nGramScore === undefined) {
      return -100.0;
    }

    let startIndex = words.length - this._size;
    if (startIndex < 0) {
      startIndex = 0;
    }
    let size = 0;
    const sizes: number[] = [];
    const targetWords: string[] = [];
    for (let i = startIndex; i < words.length; i ++) {
      const len = lengthBytesUTF8(words[i]) + 1;
      sizes.push(len);
      targetWords.push(words[i]);
      size += len;
    }
    const stringHeap = Module._malloc(size);
    let tmp = stringHeap;
    targetWords.forEach( (word, index) => {
      Module.stringToUTF8(word, tmp, sizes[index]);
      tmp += sizes[index];
    });

    const prob:number =
        this._nGramScore(stringHeap,
            targetWords.length, // query word count
            this._defaultScore);// default score for unknown
    Module._free(stringHeap);
    return prob;
  }
}

/**
 * Calculate the score for BeamEntry
 *
 * @class BeamScorer
 */
class BeamScorer {
  defaultScore: number;
  _trieWeight: number;
  _alpha: number;
  _belta: number;
  _nGramScore: NGram;

  constructor(defaultScore: number, trieWeight: number,
      alpha: number, belta: number) {
    this.defaultScore = defaultScore;
    this._trieWeight = trieWeight;
    this._alpha = alpha;
    this._belta = belta;
  }

  getScore(state: BeamState) {
    if (state && state._trieNode) {
      return state._trieNode.getMinUnigramScore();
    }
    return this.defaultScore;
  }

  getWeightedScore(state: BeamState) {
    if (state.newWord && this._nGramScore) {
      return this._alpha * this._nGramScore.score(state.words) +
          this._belta;
      // console.log(`score:${prob} for words:${state.words}`);
    } else {
      return this._trieWeight * this.getScore(state);
    }
  }

  set nGramScore(nGramScore: NGram) {
    this._nGramScore = nGramScore;
  }
}

/**
 * Store the Beam entry's state
 */
class BeamState {
  _trieNode: TrieNode;
  _words: string[];
  _newChar: number[];
  _newWord: boolean;

  constructor(trieNode: TrieNode, parent?: BeamState) {
    this._trieNode = trieNode;
    this._newWord = false;
    if (parent) {
      this._words = [...parent._words];
      this._newChar = [...parent._newChar];
    } else {
      this._words = [];
      this._newChar = [];
    }
  }

  addChar(char: number, newTrie: TrieNode) {
    // space: a new word
    if (char === 0) {
      // another space after a new word
      if (this._newWord) {
        return;
      }
      if (this._newChar.length > 0) {
        if (this._words.length === N_GRAM_SIZE) {
          this._words.shift();
        }
        this._words.push(this._newChar.map(c => CHAR_MAP[c]).join(''));
        this._newChar.length = 0;
      }
      this._trieNode = newTrie;
      this._newWord = true;
    } else {
      this._newChar.push(char);
      this._trieNode = this._trieNode ?
          this._trieNode.getChildrenMap().get(char) : undefined;
      this._newWord = false;
    }
  }

  nextState(char: number, newTrie: TrieNode) {
    const rev = new BeamState(this._trieNode, this);
    rev.addChar(char, newTrie);
    return rev;
  }

  get words() : string[] {
    return this._words;
  }

  get newWord() : boolean {
    return this._newWord;
  }

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
 * Option object to initialize the LanguageModel
 * @export
 * @interface LanguageModelOption
 */
export interface LanguageModelOption {
  /**
   * path/url to point to trie file
   * @type {string}
   * @memberof LanguageModelOption
   */
  triePath?: string;

  /**
   * path/url to point to ngram file
   * @type {string}
   * @memberof LanguageModelOption
   */
  ngram?: string;

  /**
   * weighting for trie
   * @type {number}
   * @memberof LanguageModelOption
   */
  trieWeight?: number;
}

/**
 * Wrap the Trie and Language model and provide
 * CTC decoding with language model.
 */
export class LanguageModel {
  _trieLoader: TrieLoader;
  _vocabSize: number;
  _loaded: boolean;
  _trieWeight: number;
  _scorer: BeamScorer;
  _ngram: NGram;
  _option: LanguageModelOption;
  _trieRoot: TrieNode;

  /**
   * Create the LanguageModel with specified trie
   * and vocabulary size.
   *
   * Note: it doesn't load the trie yet
   * @param {number} vocabSize label number
   * @param {LanguageModelOption} option trie path, ngram path and etc.
   */
  constructor(vocabSize: number, option?: LanguageModelOption) {
    this._vocabSize = vocabSize;
    this._trieWeight = DEFAULT_TRIE_WEIGHT;
    this._trieRoot = undefined;
    
    this._option = option || {};
    if (this._option.triePath) {
      this._trieLoader =
          new TrieLoader(this._option.triePath, this._vocabSize);
    }
    if (this._option.ngram) {
      this._ngram = new NGram(this._option.ngram, N_GRAM_SIZE);
    }
    this._trieWeight = this._option.trieWeight || DEFAULT_TRIE_WEIGHT;
    this._loaded = false;
    this._scorer = new BeamScorer(-100.0, this._trieWeight, 2.0, 1.0);
  }

  /**
   * Load Trie
   */
  load() {
    if (this._loaded || 
        (this._trieLoader === undefined && this._ngram === undefined)) {
      return Promise.resolve();
    }
    const list: Array<Promise<void>> = [];
    if (this._ngram !== undefined) {
      list.push(this._ngram.load());
    }
    if (this._trieLoader !== undefined) {
      list.push(this._trieLoader.load());
    }
    return Promise.all(list)
        .then(() => {
            this._scorer.nGramScore = this._ngram;
            this._trieRoot = this._trieLoader._rootNode;
            // console.log(`score: ${this._ngram.score(['this', 'is', 'a'])}`);
        });
  }

  /**
   * Run CTC decoding with language model
   * @param logPropbs time serial log probabilities
   * @param width beam width
   */
  beamSearch(logPropbs: number[][], width: number): BeamEntry[] {
    let beams: BeamEntry[] = [
        new BeamEntry([], new BeamState(this._trieRoot))];

    const nextState = (beam: BeamEntry, newLabel: number): BeamState => {
      return beam.state.nextState(
          newLabel, this._trieRoot);
    };

    // Walk over each time step in sequence
    logPropbs.forEach((row, tIndex) => {
      const allCandidates:BeamList = new BeamList(width);
      // Go through each BeamEntry in the candidate list
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
  get trieLoader() {
    return this._trieLoader;
  }
}
