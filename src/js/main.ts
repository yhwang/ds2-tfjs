import * as tf from '@tensorflow/tfjs';
import { parse } from './npy';

declare global {
  interface Window {
    pageLoaded?: Function;
    transcribe?: Function;
    fileSelected?: Function;
  }
}

const BLANK_INDEX: number = 28;
const CHAR_MAP: string = " abcdefghijklmnopqrstuvwxyz'-";
const SAMPLE_RATE = 16000;
const WINDOW_SIZE = 20; // 20 mS
const STRIDE_SIZE = 10; // 10 mS

class DeepSpeech {
  model: tf.GraphModel;

  // load the tfjs-graph model
  async load() {
    this.model = await tf.loadGraphModel('/model/model.json');
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
    let feature = await prepareInput(url);
    let featureBatch = feature.expandDims(0);
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
  async transcribeFile(file: File, cb?: Function) {
    // using the sampling rate while training
    const audioProcessor = new AudioProcessor(SAMPLE_RATE);
    let feature: tf.Tensor;
    let raw: ArrayBuffer;
    await measureElapsedTime('read file to ArrayBuffer', async () => {
      raw = await audioProcessor.read(file);
    });
    cb(raw);
    await measureElapsedTime('wav decode and stft', async () => {
      const rawWav = await audioProcessor.decode(raw);
      feature = audioProcessor.stft(rawWav);
    });
    const featureBatch = feature.expandDims(0);
    const transcription = this._transcribe(featureBatch);
    feature.dispose();
    featureBatch.dispose();
    return transcription;
  }

  async _transcribe(feature: tf.Tensor) {
    let pred: tf.Tensor[] = await this.model.executeAsync(
      {'features': feature}) as tf.Tensor[];
    // pred[0] == argmax of pred[1] against axes=2
    // so directly use pred[0] and cleanup pred[1]
    let t = tf.tidy(() => {
      return pred[0].squeeze([0]);
    });
    pred[1].dispose();
    let argmax = t.arraySync() as number[];
    t.dispose();
    return this._decodeStr(argmax);
  }
}

class AudioProcessor {
  sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  read(file: File): Promise<ArrayBuffer> {
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
  readAndDecode(file: File): Promise<Float32Array> {
    const audioCtx = new AudioContext({sampleRate: this.sampleRate});
    return this.read(file).then((result) => {
      return new Promise<Float32Array>((resolve) => {
        audioCtx.decodeAudioData(result).then( async (buff: AudioBuffer) => {
          updateStatus(`sample rate:${buff.sampleRate}, ch #: ${buff.numberOfChannels}, length:${buff.getChannelData(0).length}`);
          resolve(buff.getChannelData(0));
        })
      })
    });
  }

  decode(bin: ArrayBuffer): Promise<Float32Array> {
    return new Promise<Float32Array>((resolve) => {
      const audioCtx = new AudioContext({sampleRate: this.sampleRate});
      audioCtx.decodeAudioData(bin).then( async (buff: AudioBuffer) => {
        updateStatus(`sample rate:${buff.sampleRate}, ch #: ${buff.numberOfChannels}, length:${buff.getChannelData(0).length}`);
        resolve(buff.getChannelData(0));
      })
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
    let trancatedBuff = new Float32Array(
        buff.buffer, 0, buff.length - trancate);
    let stridedBuff =
        this._getStrideBuff(trancatedBuff, windowSize, strideSize);
    let shape =
        [(trancatedBuff.length - windowSize)/strideSize + 1, windowSize];
    return tf.tidy(() => {
      let hannWin = tf.hannWindow(windowSize).expandDims(0);
      let windows = tf.tensor(stridedBuff, shape, 'float32');
      // weighting
      let fft = windows.mul(hannWin).rfft().abs().square();
      // scaling
      let scale = hannWin.square().sum().mul(tf.scalar(SAMPLE_RATE));
      let fftMiddle = fft.stridedSlice([0,1], [shape[0], -1], [1, 1])
          .mul(tf.scalar(2.0, 'float32').div(scale));
      let fftFirstColumn = fft.stridedSlice([0, 0], [shape[0], 1], [1, 1])
          .div(scale);
      let fftLastColumn = fft.stridedSlice([0, -1], shape, [1, 1]).div(scale);
      fft = tf.concat([fftFirstColumn, fftMiddle, fftLastColumn], 1)
          .add(tf.scalar(1e-14)).log();
      // normalize
      let {mean, variance} = tf.moments(fft, 0, true);
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
    let shape = [ window, (buff.length - window)/stride + 1];
    let rev = new Float32Array(shape[0] * shape[1]);
    for( let i = 0; i < shape[1]; i++) {
      let tmp = new Float32Array(buff.buffer, (i * stride) * 4, window);
      rev.set(tmp, i * window);
    }
    return rev;
  }
}

class UI {
  audioSelector: HTMLInputElement;
  player: HTMLAudioElement;
  playerDiv: HTMLDivElement;
  status: HTMLLabelElement;
  transcription: HTMLLabelElement;
  transcribeBtn: HTMLButtonElement;
  fileName: HTMLLabelElement;

  constructor() {
    this.audioSelector = 
        document.getElementById('audio-file') as HTMLInputElement;
    this.player = document.getElementById('player') as HTMLAudioElement;
    this.status = document.getElementById('status') as HTMLLabelElement
    this.transcription = 
        document.getElementById('transcription') as HTMLLabelElement
    this.playerDiv = document.getElementById('playerDiv') as HTMLDivElement;
    this.transcribeBtn =
        document.getElementById('transcribe') as HTMLButtonElement;
    this.fileName = document.getElementById('fileName') as HTMLLabelElement;
  }

  enable(elem: HTMLElement) {
    elem.removeAttribute('disabled');
  }

  disable(elem: HTMLElement) {
    elem.setAttribute('disabled', 'true');
  }

  display(elem: HTMLElement) {
    elem.style.display = 'block';
  }

  hide(elem: HTMLElement) {
    elem.style.display = 'none';
  }

  addSpinner(elem: HTMLElement, label?: string) {
    let spinner = document.createElement('span');
    spinner.setAttribute('class', 'spinner-border spinner-border-sm');
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
    elem.appendChild(spinner);
    if (label) {
      elem.appendChild(document.createTextNode(label));
    }
  }

  replaceText(elem: HTMLElement, label: string) {
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
    elem.appendChild(document.createTextNode(label));
  }
}

const ds = new DeepSpeech();
let ui: UI;

async function pageLoaded() {
  let start = Date.now();
  ui = new UI();
  await measureElapsedTime('loading model', async () => {
    await loadModel();
  });
  // after loading the model, enable the transcribe button
  ui.enable(ui.audioSelector);
}

async function measureElapsedTime(task: string, func: Function) {
  const start = Date.now();
  await func();
  console.log(`${task}: ${Date.now() - start}`);
}

// Load the model and update UI
async function loadModel() {
  updateStatus('loading DS2 model.....');
  await ds.load();
  updateStatus('DS2 model loaded!');
}

// Transcribe and update UI
async function transcribe(element: HTMLInputElement) {
  if (ui.audioSelector.files.length == 0) {
    return;
  }
  ui.disable(ui.audioSelector);
  ui.disable(element);
  updateTranscription('');
  ui.addSpinner(element, 'Transcribe...');
  await measureElapsedTime('transcribe', async () => {
    let transcription = await ds.transcribeFile(ui.audioSelector.files[0],
        (bin:ArrayBuffer) => showAudioControl(bin));
        updateTranscription(transcription);
  });
  ui.replaceText(element, 'Transcribe');
  ui.enable(ui.audioSelector);
  ui.enable(element);
}
// async function transcribe(url: string) {
//   updateStatus('transcribe.....');
//   let transcription = await ds.transcribe(url);
//   updateStatus(`transcription: ${transcription}`);
// }

function prepareInput(url: string): Promise<tf.Tensor> {
  return new Promise((resolve, reject) => {
    fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => resolve(parse(data)));
  });
}

function showAudioControl(bin: ArrayBuffer) {
  ui.player.src = URL.createObjectURL(new Blob([bin]));
  ui.player.load();
  ui.display(ui.playerDiv);
}

function updateStatus(msg: string) {
  ui.status.innerHTML = `status: ${msg}`;
}

function updateTranscription(msg: string) {
  ui.transcription.innerHTML = msg;
}

function fileSelected(element: HTMLInputElement) {
  if (element.files.length > 0) {
    ui.replaceText(ui.fileName, ui.audioSelector.files[0].name);
    ui.enable(ui.transcribeBtn);
  }
}
// attach functions to window object to prevent the pruning
window.pageLoaded = pageLoaded;
window.transcribe = transcribe;
window.fileSelected = fileSelected;
