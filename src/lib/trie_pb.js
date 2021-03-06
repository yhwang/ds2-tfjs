/**
 * @fileoverview
 * @enhanceable
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

goog.exportSymbol('proto.trie.Trie', null, global);
goog.exportSymbol('proto.trie.TrieNode', null, global);

/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.trie.TrieNode = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.trie.TrieNode, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  proto.trie.TrieNode.displayName = 'proto.trie.TrieNode';
}


if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto suitable for use in Soy templates.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     com.google.apps.jspb.JsClassTemplate.JS_RESERVED_WORDS.
 * @param {boolean=} opt_includeInstance Whether to include the JSPB instance
 *     for transitional soy proto support: http://goto/soy-param-migration
 * @return {!Object}
 */
proto.trie.TrieNode.prototype.toObject = function(opt_includeInstance) {
  return proto.trie.TrieNode.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Whether to include the JSPB
 *     instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.trie.TrieNode} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.trie.TrieNode.toObject = function(includeInstance, msg) {
  var f, obj = {
    vocabSize: jspb.Message.getField(msg, 1),
    prefixCount: jspb.Message.getField(msg, 2),
    minScoreWord: jspb.Message.getField(msg, 3),
    minUnigramScore: jspb.Message.getOptionalFloatingPointField(msg, 4),
    childrenMap: (f = msg.getChildrenMap()) ? f.toObject(includeInstance, proto.trie.TrieNode.toObject) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.trie.TrieNode}
 */
proto.trie.TrieNode.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.trie.TrieNode;
  return proto.trie.TrieNode.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.trie.TrieNode} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.trie.TrieNode}
 */
proto.trie.TrieNode.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setVocabSize(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPrefixCount(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readUint32());
      msg.setMinScoreWord(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readFloat());
      msg.setMinUnigramScore(value);
      break;
    case 5:
      var value = msg.getChildrenMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readInt32, jspb.BinaryReader.prototype.readMessage, proto.trie.TrieNode.deserializeBinaryFromReader);
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.trie.TrieNode.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.trie.TrieNode.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.trie.TrieNode} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.trie.TrieNode.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = /** @type {number} */ (jspb.Message.getField(message, 1));
  if (f != null) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 2));
  if (f != null) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeUint32(
      3,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 4));
  if (f != null) {
    writer.writeFloat(
      4,
      f
    );
  }
  f = message.getChildrenMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(5, writer, jspb.BinaryWriter.prototype.writeInt32, jspb.BinaryWriter.prototype.writeMessage, proto.trie.TrieNode.serializeBinaryToWriter);
  }
};


/**
 * required int32 vocab_size = 1;
 * @return {number}
 */
proto.trie.TrieNode.prototype.getVocabSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/** @param {number} value */
proto.trie.TrieNode.prototype.setVocabSize = function(value) {
  jspb.Message.setField(this, 1, value);
};


proto.trie.TrieNode.prototype.clearVocabSize = function() {
  jspb.Message.setField(this, 1, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.TrieNode.prototype.hasVocabSize = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * required int32 prefix_count = 2;
 * @return {number}
 */
proto.trie.TrieNode.prototype.getPrefixCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/** @param {number} value */
proto.trie.TrieNode.prototype.setPrefixCount = function(value) {
  jspb.Message.setField(this, 2, value);
};


proto.trie.TrieNode.prototype.clearPrefixCount = function() {
  jspb.Message.setField(this, 2, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.TrieNode.prototype.hasPrefixCount = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional uint32 min_score_word = 3;
 * @return {number}
 */
proto.trie.TrieNode.prototype.getMinScoreWord = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/** @param {number} value */
proto.trie.TrieNode.prototype.setMinScoreWord = function(value) {
  jspb.Message.setField(this, 3, value);
};


proto.trie.TrieNode.prototype.clearMinScoreWord = function() {
  jspb.Message.setField(this, 3, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.TrieNode.prototype.hasMinScoreWord = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional float min_unigram_score = 4;
 * @return {number}
 */
proto.trie.TrieNode.prototype.getMinUnigramScore = function() {
  return /** @type {number} */ (+jspb.Message.getFieldWithDefault(this, 4, 0.0));
};


/** @param {number} value */
proto.trie.TrieNode.prototype.setMinUnigramScore = function(value) {
  jspb.Message.setField(this, 4, value);
};


proto.trie.TrieNode.prototype.clearMinUnigramScore = function() {
  jspb.Message.setField(this, 4, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.TrieNode.prototype.hasMinUnigramScore = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * map<int32, TrieNode> children = 5;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<number,!proto.trie.TrieNode>}
 */
proto.trie.TrieNode.prototype.getChildrenMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<number,!proto.trie.TrieNode>} */ (
      jspb.Message.getMapField(this, 5, opt_noLazyCreate,
      proto.trie.TrieNode));
};


proto.trie.TrieNode.prototype.clearChildrenMap = function() {
  this.getChildrenMap().clear();
};



/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.trie.Trie = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.trie.Trie, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  proto.trie.Trie.displayName = 'proto.trie.Trie';
}


if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto suitable for use in Soy templates.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     com.google.apps.jspb.JsClassTemplate.JS_RESERVED_WORDS.
 * @param {boolean=} opt_includeInstance Whether to include the JSPB instance
 *     for transitional soy proto support: http://goto/soy-param-migration
 * @return {!Object}
 */
proto.trie.Trie.prototype.toObject = function(opt_includeInstance) {
  return proto.trie.Trie.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Whether to include the JSPB
 *     instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.trie.Trie} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.trie.Trie.toObject = function(includeInstance, msg) {
  var f, obj = {
    magic: jspb.Message.getField(msg, 1),
    version: jspb.Message.getField(msg, 2),
    vocabSize: jspb.Message.getField(msg, 3),
    rootNode: (f = msg.getRootNode()) && proto.trie.TrieNode.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.trie.Trie}
 */
proto.trie.Trie.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.trie.Trie;
  return proto.trie.Trie.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.trie.Trie} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.trie.Trie}
 */
proto.trie.Trie.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMagic(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setVersion(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setVocabSize(value);
      break;
    case 4:
      var value = new proto.trie.TrieNode;
      reader.readMessage(value,proto.trie.TrieNode.deserializeBinaryFromReader);
      msg.setRootNode(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.trie.Trie.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.trie.Trie.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.trie.Trie} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.trie.Trie.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = /** @type {number} */ (jspb.Message.getField(message, 1));
  if (f != null) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 2));
  if (f != null) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getRootNode();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.trie.TrieNode.serializeBinaryToWriter
    );
  }
};


/**
 * required int32 magic = 1;
 * @return {number}
 */
proto.trie.Trie.prototype.getMagic = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/** @param {number} value */
proto.trie.Trie.prototype.setMagic = function(value) {
  jspb.Message.setField(this, 1, value);
};


proto.trie.Trie.prototype.clearMagic = function() {
  jspb.Message.setField(this, 1, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.Trie.prototype.hasMagic = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * required int32 version = 2;
 * @return {number}
 */
proto.trie.Trie.prototype.getVersion = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/** @param {number} value */
proto.trie.Trie.prototype.setVersion = function(value) {
  jspb.Message.setField(this, 2, value);
};


proto.trie.Trie.prototype.clearVersion = function() {
  jspb.Message.setField(this, 2, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.Trie.prototype.hasVersion = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * required int32 vocab_size = 3;
 * @return {number}
 */
proto.trie.Trie.prototype.getVocabSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/** @param {number} value */
proto.trie.Trie.prototype.setVocabSize = function(value) {
  jspb.Message.setField(this, 3, value);
};


proto.trie.Trie.prototype.clearVocabSize = function() {
  jspb.Message.setField(this, 3, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.Trie.prototype.hasVocabSize = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * required TrieNode root_node = 4;
 * @return {!proto.trie.TrieNode}
 */
proto.trie.Trie.prototype.getRootNode = function() {
  return /** @type{!proto.trie.TrieNode} */ (
    jspb.Message.getWrapperField(this, proto.trie.TrieNode, 4, 1));
};


/** @param {!proto.trie.TrieNode} value */
proto.trie.Trie.prototype.setRootNode = function(value) {
  jspb.Message.setWrapperField(this, 4, value);
};


proto.trie.Trie.prototype.clearRootNode = function() {
  jspb.Message.setField(this, 4, undefined);
};


/**
 * Returns whether this field is set.
 * @return {!boolean}
 */
proto.trie.Trie.prototype.hasRootNode = function() {
  return jspb.Message.getField(this, 4) != null;
};

module.exports.Trie = proto.trie.Trie;
module.exports.TrieNode = proto.trie.TrieNode;
