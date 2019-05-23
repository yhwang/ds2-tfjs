import * as tf from '@tensorflow/tfjs';

declare global {
  interface Window { pageLoaded?: Function; }
}

export class DeepSpeech {
  model: tf.GraphModel;

  async load() {
    this.model = await tf.loadGraphModel('/model/model.json');
  }
}

async function pageLoaded() {
  var ds = new DeepSpeech();
  await ds.load();
  console.log(ds.model);
}


window.pageLoaded = pageLoaded;
