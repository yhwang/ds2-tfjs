// Blank index (-) in the CHAR_MAP
export const EN_BLANK_INDEX = 28;
// Character list for English
export const EN_CHARS = ' abcdefghijklmnopqrstuvwxyz\'';
// Character map for English. string as key and index as value
export const EN_CHAR_MAP: {[key: string]: number} = {};
export const EPSILON = 1e-5;
export const DEFAULT_TRIE_WEIGHT = 0.2;
export const N_GRAM_SIZE = 3;
export const IS_NODE = typeof(window) === 'undefined';

// Initialize the EN_CHAR_MAP
for (let index = 0, len = EN_CHARS.length; index < len; index++) {
  EN_CHAR_MAP[EN_CHARS.charAt(index)] = index;
}

let fetch
    : (input: RequestInfo, init?: RequestInit) => Promise<Response>;

// detect the execution environment: node or browser
if (IS_NODE) {
  fetch = require('node-fetch');
} else {
  fetch = window.fetch;
}

// Provide a fetch wrapper for both browser and node.js environments
export const fetchWrapper = (input: RequestInfo, init?: RequestInit)
    : Promise<ArrayBuffer> => {

  if (input.toString().toLowerCase().startsWith('http') || !IS_NODE) {
      return fetch(input, init)
            .then(resp => resp.arrayBuffer());
  } else {
      const fs = require('fs');
      return new Promise<ArrayBuffer>((resolve, reject) => {
        fs.readFile(input, (error: Error, data: Buffer) => {
          if (error) {
            return reject(error);
          }
          resolve(data.buffer);
        });
      });
  }
};
