// package: trie
// file: trie.proto

import * as jspb from 'google-protobuf';

export class TrieNode extends jspb.Message {
  hasVocabSize(): boolean;
  clearVocabSize(): void;
  getVocabSize(): number | undefined;
  setVocabSize(value: number): void;

  hasPrefixCount(): boolean;
  clearPrefixCount(): void;
  getPrefixCount(): number | undefined;
  setPrefixCount(value: number): void;

  hasMinScoreWord(): boolean;
  clearMinScoreWord(): void;
  getMinScoreWord(): number | undefined;
  setMinScoreWord(value: number): void;

  hasMinUnigramScore(): boolean;
  clearMinUnigramScore(): void;
  getMinUnigramScore(): number | undefined;
  setMinUnigramScore(value: number): void;

  getChildrenMap(): jspb.Map<number, TrieNode>;
  clearChildrenMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TrieNode.AsObject;
  static toObject(includeInstance: boolean, msg: TrieNode): TrieNode.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: 
      {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(
      message: TrieNode, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TrieNode;
  static deserializeBinaryFromReader(
      message: TrieNode, reader: jspb.BinaryReader): TrieNode;
}

export namespace TrieNode {
  export type AsObject = {
    vocabSize?: number,
    prefixCount?: number,
    minScoreWord?: number,
    minUnigramScore?: number,
    childrenMap: Array<[number, TrieNode.AsObject]>,
  };
}

export class Trie extends jspb.Message {
  hasMagic(): boolean;
  clearMagic(): void;
  getMagic(): number | undefined;
  setMagic(value: number): void;

  hasVersion(): boolean;
  clearVersion(): void;
  getVersion(): number | undefined;
  setVersion(value: number): void;

  hasVocabSize(): boolean;
  clearVocabSize(): void;
  getVocabSize(): number | undefined;
  setVocabSize(value: number): void;

  hasRootNode(): boolean;
  clearRootNode(): void;
  getRootNode(): TrieNode;
  setRootNode(value?: TrieNode): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Trie.AsObject;
  static toObject(includeInstance: boolean, msg: Trie): Trie.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary:
      {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(
      message: Trie, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Trie;
  static deserializeBinaryFromReader(
      message: Trie, reader: jspb.BinaryReader): Trie;
}

export namespace Trie {
  export type AsObject = {
    magic?: number,
    version?: number,
    vocabSize?: number,
    rootNode: TrieNode.AsObject,
  };
}
