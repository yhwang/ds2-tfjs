const TARGET_SAMPLE_RATE = 16000;

// Downsampling and low-pass filter:
// Input audio is typically 44.1kHz or 48kHz, this downsamples it to 16kHz.
// It uses a FIR (finite impulse response) Filter to remove
// (or, at least attinuate) audio frequencies > ~8kHz because sampled audio
// cannot accurately represent frequiencies greater than half of the sample
// rate. (Human voice tops out at < 4kHz, so nothing important is lost for
// transcription.)
// See http://dsp.stackexchange.com/a/37475/26392 for a good explanation of
// this code.
const FILTER = [
  -0.037935,
  -0.00089024,
  0.040173,
  0.019989,
  0.0047792,
  -0.058675,
  -0.056487,
  -0.0040653,
  0.14527,
  0.26927,
  0.33913,
  0.26927,
  0.14527,
  -0.0040653,
  -0.056487,
  -0.058675,
  0.0047792,
  0.019989,
  0.040173,
  -0.00089024,
  -0.037935
];
 
/**
 * Downsample the audio data from {srcSampleRate} to 16 kHz
 * @param {Float32Array} data audo data for a single channel
 * @param {number} srcSampleRate source sameple rate
 * @returns Float32Array with 16 kHz sample rate
 */
export const downsampleTo16K = (data: Float32Array, srcSampleRate: number) => {
  const ratio = srcSampleRate / TARGET_SAMPLE_RATE;
  const outLen =
      Math.floor((data.length - FILTER.length) / ratio) + 1;
  const rev = new Float32Array(outLen);
  for (let i = 0, end = data.length - FILTER.length + 1; i < end; i++) {
    const offset = Math.round(ratio * i);
    let sample = 0;
    for (let j = 0, len = FILTER.length; j < len; ++j) {
      sample += data[offset + j] * FILTER[j];
    }
    rev[i] = sample;
  }
  return rev;
};
