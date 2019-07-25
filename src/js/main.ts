import * as tf from '@tensorflow/tfjs';
import { parse } from './npy';
import { beamSearch } from './beam_search';
import { BLANK_INDEX, CHAR_MAP } from './constants';

declare global {
  interface Window {
    pageLoaded?: Function;
    transcribe?: Function;
    fileSelected?: Function;
    record?: Function;
  }
}

const SAMPLE_RATE = 16000;
const WINDOW_SIZE = 20; // 20 mS
const STRIDE_SIZE = 10; // 10 mS

class DeepSpeech {
  model: tf.GraphModel;

  // load the tfjs-graph model
  async load(loc: string) {
    this.model = await tf.loadGraphModel(loc);
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
  async transcribeFile(file: File|Blob, cb?: Function) {
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
    const pred: tf.Tensor[] = await this.model.executeAsync(
      {'features': feature}) as tf.Tensor[];
    // pred[0] == argmax of pred[1] against axes=2
    const logProbs = tf.tidy(() => pred[1].squeeze([0]).log());
    const results = beamSearch(logProbs.arraySync() as number[][], 5);
    logProbs.dispose();
    pred[0].dispose();
    pred[1].dispose();
    return results[0].convertToStr();
  }
}

class AudioProcessor {
  sampleRate: number;

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
    updateStatus(`sample rate:${buff.sampleRate},` +
          ` ch #: ${buff.numberOfChannels}, ` +
          `length:${buff.getChannelData(0).length}`);
    return buff.getChannelData(0);
  }

  async decode(bin: ArrayBuffer): Promise<Float32Array> {
    const audioCtx = new AudioContext({sampleRate: this.sampleRate});
    const buff = await audioCtx.decodeAudioData(bin);
    updateStatus(`sample rate:${buff.sampleRate}, ` +
        `ch #: ${buff.numberOfChannels}, ` +
        `length:${buff.getChannelData(0).length}`);
    return buff.getChannelData(0);
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

class UI {
  audioSelector: HTMLInputElement;
  player: HTMLAudioElement;
  playerDiv: HTMLDivElement;
  status: HTMLLabelElement;
  transcription: HTMLLabelElement;
  transcribeBtn: HTMLButtonElement;
  fileName: HTMLLabelElement;
  recordBtn: HTMLButtonElement;
  recordDiv: HTMLDivElement;
  mediaStream: MediaStream;
  recorder: MediaRecorder;
  microphoneIcon: HTMLElement;
  microphoneSlashIcon: HTMLElement;

  constructor() {
    this.audioSelector = 
        document.getElementById('audio-file') as HTMLInputElement;
    this.player = document.getElementById('player') as HTMLAudioElement;
    this.status = document.getElementById('status') as HTMLLabelElement;
    this.transcription = 
        document.getElementById('transcription') as HTMLLabelElement;
    this.playerDiv = document.getElementById('playerDiv') as HTMLDivElement;
    this.transcribeBtn =
        document.getElementById('transcribe') as HTMLButtonElement;
    this.fileName = document.getElementById('fileName') as HTMLLabelElement;
    this.recordBtn = document.getElementById('record') as HTMLButtonElement;
    this.recordDiv = document.getElementById('recordDiv') as HTMLDivElement;
    this.mediaStream = null;
    this.recorder = null;
    this.microphoneIcon = document.createElement('i');
    this.microphoneIcon.setAttribute(
        'class', 'fa fa-microphone-alt fa-fw text-danger mid-icon');
    this.microphoneSlashIcon = document.createElement('i');
    this.microphoneSlashIcon.setAttribute(
        'class', 'far fa-stop-circle fa-fw text-danger mid-icon px-1');
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
    const spinner = document.createElement('span');
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

  replaceChild(elem: HTMLElement, child: HTMLElement) {
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
    elem.appendChild(child);
  }
}

const ds = new DeepSpeech();
let ui: UI;

async function pageLoaded() {
  ui = new UI();
  if (hasGetUserMedia()) {
    navigator.mediaDevices.getUserMedia({audio: true})
        .then((stream) => {
          ui.display(ui.recordDiv);
          ui.mediaStream = stream;
        });
  }
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
  await ds.load('/model/model.json');
  updateStatus('DS2 model loaded!');
}

// Transcribe and update UI
async function transcribe(element: HTMLInputElement) {
  if (ui.audioSelector.files.length === 0) {
    return;
  }
  ui.disable(ui.audioSelector);
  ui.disable(element);
  updateTranscription('');
  ui.addSpinner(element, 'Transcribe...');
  await measureElapsedTime('transcribe', async () => {
    const transcription = await ds.transcribeFile(ui.audioSelector.files[0],
        (bin:ArrayBuffer) => showAudioControl(bin));
        updateTranscription(transcription);
  });
  ui.replaceText(element, 'Transcribe');
  ui.enable(ui.audioSelector);
  ui.enable(element);
}

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

function hasGetUserMedia() {
  return !!(navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia);
}

function record(element: HTMLButtonElement) {
  if (ui.mediaStream === null) {
    return;
  }

  if (ui.recorder === null) {
    ui.recorder = new MediaRecorder(ui.mediaStream);
    ui.recorder.ondataavailable = (e: MediaRecorderDataAvailableEvent) => {
      ui.player.src = URL.createObjectURL(e.data);
      ui.player.load();
      ui.display(ui.playerDiv);
      transcribeRecording(e.data);
      ui.disable(ui.recordBtn);
    };
  }

  if (ui.recorder.state === 'inactive') {
    //start recording
    ui.recorder.start();
    updateStatus('recording now.......');
    ui.replaceChild(ui.recordBtn, ui.microphoneSlashIcon);
  } else {
    //stop recording
    ui.recorder.stop();
    ui.replaceChild(ui.recordBtn, ui.microphoneIcon);
    updateStatus('stop recording and start to transcribe....');
  }
}

async function transcribeRecording(recording: Blob) {
  ui.disable(ui.audioSelector);
  ui.disable(ui.transcribeBtn);
  updateTranscription('');
  ui.addSpinner(ui.transcribeBtn, 'Transcribe...');
  await measureElapsedTime('transcribe', async () => {
    const transcription = await ds.transcribeFile(recording);
        updateTranscription(transcription);
  });
  ui.replaceText(ui.transcribeBtn, 'Transcribe');
  ui.enable(ui.audioSelector);
  ui.enable(ui.recordBtn);
  updateStatus('done');
}

// attach functions to window object to prevent the pruning
window.pageLoaded = pageLoaded;
window.transcribe = transcribe;
window.fileSelected = fileSelected;
window.record = record;
