[![Build Status](https://travis-ci.org/yhwang/ds2-tfjs.svg?branch=master)](https://travis-ci.org/yhwang/ds2-tfjs)

# Enable the DeepSpeech2 in a browser

This repo provides a web application that uses the tensorflow.js to serve the pre-trained DeepSpeech2 model
in a browser. It processes the audio input and feeds the audio spectrogram into the model. It also contains
the CTCDecoder implementation to process the output of the DeepSpeech2 model, including character level and
word level n-gram.

## DeepSpeech2 pre-trained model

The model and dataset for the pre-trained model are here:
- [DeepSpeech2](https://github.com/tensorflow/models/tree/master/research/deep_speech) 
- [LibriSpeech dataset](http://www.openslr.org/12)

You can find detailed information about the model and dataset in the links above.
We trained the model for 20 epochs and save the model into SavedModel format. In order to
use the model in tensorflow.js, we use [tfjs-converter](https://www.npmjs.com/package/@tensorflow/tfjs-converter)
to convert the SavedModel to Web friendly format for tensorflow.js.
Here is the [pre-trained model](https://ds2-tfjs.mybluemix.net/download/model.tgz).
The configuration for the model is 4 Bi-directional RNN with 512 nodes.
After you download the model, you need to extract the model files into `public/model`
directory. For example:
```
# Assuming you are at the repository's root directory
mkdir -p public/model

# Change the model.tar.gz to where your download file is
tar xf model.tgz -C public/model
```

## N-Gram language model and Trie
 
In order to reduce the network overhead, we chose [3-gram ARPA LM and pruned with theshold 1e-7](http://www.openslr.org/resources/11/3-gram.pruned.1e-7.arpa.gz).
Its binary format is about 26MB. You can download it from [here](https://ds2-tfjs.mybluemix.net/download/3-gram.binary.tar.gz).
Then extract it to `public` directory. For example:
```
# Change the 3-gram.binary.tar.gz to where your download file is
 tar xf 3-gram.binary.tar.gz -C public
```

And trie file is [here](https://ds2-tfjs.mybluemix.net/download/trie.binary.tar.gz). 
Please also extract the trie file to `public` directory. For example:
```
# Change the trie.binary.tar.gz to where your download file is
 tar xf trie.binary.tar.gz -C public
```
 
## Application Set Up

We implement the data pre-process and Connectionist temporal classification(CTC) decoder with N-Gram language model
in tensorflow.js. Part of the CTC decoder is implemented in WebAssembly. You can see how to build the WebAssembly
module in [README](kenlm-wasm/README.md) under `kenlm-wasm` directory. Since WebAssembly module is LLVM bitcode,
you can also directly use the bitcode under `kenlm-wasm` directory by directly copy `module.js` and `module.wasm` into
`public/js` directory.

Here is the instruction to set up the web application:
- Run `npm install` to install dependencies packages
- Run `npm run build` to compile the TypeScript source codes

## Launch Web Application

Run the web application by running `npm run start` command.
It will start the web server in http://localhost:3000 .

You can also access the demo website here: https://ds2-tfjs.mybluemix.net/
