import { DeepSpeech, measureElapsedTime, LanguageModel, EN_VOCABULARY }
    from '../lib/index';

declare global {
  interface Window {
    pageLoaded?: Function;
    transcribe?: Function;
    fileSelected?: Function;
    record?: Function;
    AudioContext?: Function;
    webkitAudioContext?: Function;
  }

  interface EmscriptenModule {
    runtimeInitialized?: boolean;
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

const languageModel =
    new LanguageModel(EN_VOCABULARY,
        {
          triePath: '/trie.binary',
          ngram: '/3-gram.binary'
        });
const ds = new DeepSpeech(languageModel);
let ui: UI;

async function pageLoaded() {
  ui = new UI();
  if (hasGetUserMedia()) {
    ui.disable(ui.recordBtn);
    navigator.mediaDevices.getUserMedia({audio: true})
        .then((stream: MediaStream) => {
          ui.display(ui.recordDiv);
          ui.mediaStream = stream;
        });
  }
  measureElapsedTime('loading model', () => {
    return loadModel();
  }).then(() => {
    // after loading the model, enable the transcribe button
    ui.enable(ui.audioSelector);
    ui.enable(ui.recordBtn);
  });
}

// Load the model and update UI
function loadModel() {
  updateStatus('loading DS2 model.....');
  return Promise.all([ds.load('/model/model.json'), languageModel.load()])
      .then(() => {
        updateStatus('DS2 model loaded!');
      });
}

// Transcribe and update UI
async function transcribe(element: HTMLInputElement) {
  if (ui.audioSelector.files.length === 0) {
    return;
  }
  ui.disable(ui.audioSelector);
  ui.disable(element);
  ui.disable(ui.recordBtn);
  updateTranscription('');
  ui.addSpinner(element, 'Transcribe...');
  await measureElapsedTime('transcribe', async () => {
    const transcription = await ds.transcribeFile(ui.audioSelector.files[0],
        {beamWidth: 64},
        (bin:ArrayBuffer) => showAudioControl(bin),
        (sampleRate, channelNum, length) => {
          updateStatus(`sample rate:${sampleRate}, ` +
              `ch #: ${channelNum}, ` +
              `length:${length}`);
        });
        updateTranscription(transcription);
  });
  ui.replaceText(element, 'Transcribe');
  ui.enable(ui.audioSelector);
  ui.enable(element);
  ui.enable(ui.recordBtn);
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
  ui.disable(ui.recordBtn);
  ui.addSpinner(ui.transcribeBtn, 'Transcribe...');
  await measureElapsedTime('transcribe', async () => {
    const transcription = await ds.transcribeFile(recording,
        {beamWidth: 64},
        () => {},
        (sampleRate, channelNum, length) => {
          updateStatus(`sample rate:${sampleRate}, ` +
              `ch #: ${channelNum}, ` +
              `length:${length}`);
        });
    updateTranscription(transcription);
  });
  ui.replaceText(ui.transcribeBtn, 'Transcribe');
  ui.enable(ui.audioSelector);
  ui.enable(ui.recordBtn);
  updateStatus('done');
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

// attach functions to window object to prevent the pruning
window.pageLoaded = pageLoaded;
window.transcribe = transcribe;
window.fileSelected = fileSelected;
window.record = record;
