import * as tf from '@tensorflow/tfjs';
import { BLANK_INDEX, CHAR_MAP } from './constants';
import { LanguageModel } from './beam_search';
import { downsampleTo16K } from './webaudiol16';

import { parse } from './npy';

export * from './beam_search';

const SAMPLE_RATE = 16000;
const WINDOW_SIZE = 20; // 20 mS
const STRIDE_SIZE = 10; // 10 mS

type StatusUpdateCallback = (sampleRate: number,
  channelNum: number,
  length: number) => void;

export class DeepSpeech {
  model: tf.GraphModel;
  languageModel: LanguageModel;

  constructor(langModel: LanguageModel) {
    this.languageModel = langModel;
  }

  // load the tfjs-graph model
  load(loc: string) {
    return Promise.resolve().then(() => {
      return tf.loadGraphModel(loc);
    }).then((model) => {
      this.model = model;
    });
  }

  // CTC greedy decoder implementation
  _decodeStr(source: number[]) : string {
    return source.reduce( (pre, curr, ) => {
      // groupby
      pre = pre || [];
      if (pre[pre.length - 1] !== curr) {
        pre.push(curr);
      }
      return pre;
    }, [])
    .filter( (item) => {
      // remove blank index
      return item !== BLANK_INDEX;
    }).map((charIndex) => {
      // map to char
      return CHAR_MAP.charAt(charIndex);
    }).join('');
  }

  /**
   * Read a npy file as tf.Tensor and feed it to the model
   * The npy is saved from python program and output of stft
   * data preprocessing. Its shape should be [,161, 1];
   */
  async transcribe(url: string) {
    const feature = await prepareInput(url);
    const featureBatch = feature.expandDims(0);
    const transcription = this._transcribe(featureBatch);
    feature.dispose();
    featureBatch.dispose();
    return transcription;
  }

  /**
   * Read the File and run data preprocessing (stft),
   * model inference, CTC greedy decoding and return
   * the transcription
   */
  async transcribeFile(file: File|Blob,
      cb?: (data: ArrayBuffer) => void,
      statusUpdate?: StatusUpdateCallback) {
    // using the sampling rate while training
    const audioProcessor = new AudioProcessor(SAMPLE_RATE);
    let feature: tf.Tensor;
    let raw: ArrayBuffer;

    await measureElapsedTime('read file to ArrayBuffer', async () => {
      raw = await audioProcessor.read(file);
    });
    if (cb) {
      cb(raw);
    }
    await measureElapsedTime('wav decode and stft', async () => {
      const rawWav = await audioProcessor.decode(raw, statusUpdate);
      feature = audioProcessor.stft(rawWav);
    });
    const featureBatch = feature.expandDims(0);
    const transcription = this._transcribe(featureBatch);
    feature.dispose();
    featureBatch.dispose();
    return transcription;
  }

  async _transcribe(feature: tf.Tensor) {
    const pred: tf.Tensor[] = await this.model.executeAsync(
      {'features': feature}) as tf.Tensor[];
    // pred[0] == argmax of pred[1] against axes=2
    const logProbs = tf.tidy(() => pred[1].squeeze([0]).log());
    const results = this.languageModel.beamSearch(
        logProbs.arraySync() as number[][], 64);
    logProbs.dispose();
    pred[0].dispose();
    pred[1].dispose();
    // results.slice(0, 5).forEach(one => console.log(one.toString()));
    return results[0].convertToStr();
  }
}

class AudioProcessor {
  sampleRate: number;
  statusUpdate: (sampleRate: number, channel: number, length: number) => void;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  read(file: File|Blob): Promise<ArrayBuffer> {
    const fr = new FileReader();
    const rev = new Promise<ArrayBuffer>((resolve, reject) => {
      fr.onload = (ev: ProgressEvent) => {
        resolve(fr.result as ArrayBuffer);
      };
      fr.readAsArrayBuffer(file);
    });
    return rev;
  }

  /**
   * Decode the wav file with the specified sample rate
   * @param file Blob to decode
   */
  async readAndDecode(file: File): Promise<Float32Array> {
    const audioCtx = new AudioContext({sampleRate: this.sampleRate});
    const result = await this.read(file);
    const buff = await audioCtx.decodeAudioData(result);
    if (this.statusUpdate) {
      this.statusUpdate(
          buff.sampleRate,
          buff.numberOfChannels,
          buff.getChannelData(0).length);
    }
    return buff.getChannelData(0);
  }

  decode(bin: ArrayBuffer, statusUpdate?: StatusUpdateCallback)
      :Promise<Float32Array> {
    const audioCtx = new AudioContext({sampleRate: this.sampleRate});
    return new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(bin, (buff: AudioBuffer) => {
        if (this.statusUpdate) {
          this.statusUpdate(buff.sampleRate,
              buff.numberOfChannels,
              buff.getChannelData(0).length);
        }
        if (buff.sampleRate !== this.sampleRate) {
          // downsample
          console.log('downsampling to 16000 and using single channel');
          resolve(downsampleTo16K(buff.getChannelData(0), buff.sampleRate));
        } else {
          resolve(buff.getChannelData(0));
        }
      }, (error) => {
        reject(error);
      });
    });
  }

  /**
   * Compute the spectrograms for the input samples(waveforms).
   * https://en.wikipedia.org/wiki/Short-time_Fourier_transform.
   * @param buff 
   */
  stft(buff: Float32Array) {
    const windowSize = SAMPLE_RATE * 0.001 * WINDOW_SIZE;
    const strideSize = SAMPLE_RATE * 0.001 * STRIDE_SIZE;
    const trancate = (buff.length - windowSize ) % strideSize;
    const trancatedBuff = new Float32Array(
        buff.buffer, 0, buff.length - trancate);
    const stridedBuff =
        this._getStrideBuff(trancatedBuff, windowSize, strideSize);
    const shape =
        [(trancatedBuff.length - windowSize)/strideSize + 1, windowSize];
    return tf.tidy(() => {
      const hannWin = tf.hannWindow(windowSize).expandDims(0);
      const windows = tf.tensor(stridedBuff, shape, 'float32');
      // weighting
      let fft = windows.mul(hannWin).rfft().abs().square();
      // scaling
      const scale = hannWin.square().sum().mul(tf.scalar(SAMPLE_RATE));
      const fftMiddle = fft.stridedSlice([0,1], [shape[0], -1], [1, 1])
          .mul(tf.scalar(2.0, 'float32').div(scale));
      const fftFirstColumn = fft.stridedSlice([0, 0], [shape[0], 1], [1, 1])
          .div(scale);
      const fftLastColumn = fft.stridedSlice([0, -1], shape, [1, 1]).div(scale);
      fft = tf.concat([fftFirstColumn, fftMiddle, fftLastColumn], 1)
          .add(tf.scalar(1e-14)).log();
      // normalize
      const {mean, variance} = tf.moments(fft, 0, true);
      return fft.sub(mean).div(variance.sqrt().sub(tf.scalar(1e-6)))
          .expandDims(2);
    });
  }

  /**
   * Based on the window size and stride size to compose a
   * @param buff 
   * @param window 
   * @param stride 
   */
  _getStrideBuff(buff: Float32Array, window: number, stride: number)
      : Float32Array {
    const shape = [ window, (buff.length - window)/stride + 1];
    const rev = new Float32Array(shape[0] * shape[1]);
    for( let i = 0; i < shape[1]; i++) {
      const tmp = new Float32Array(buff.buffer, (i * stride) * 4, window);
      rev.set(tmp, i * window);
    }
    return rev;
  }
}

function prepareInput(url: string): Promise<tf.Tensor> {
    return new Promise((resolve, reject) => {
        fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => resolve(parse(data)));
    });
}

export const measureElapsedTime = (task: string, func: () => void) => {
  const start = Date.now();
  return Promise.resolve().then(() => {
    return func();
  }).then(() => {
    console.log(`${task}: ${Date.now() - start}`);
  });
};