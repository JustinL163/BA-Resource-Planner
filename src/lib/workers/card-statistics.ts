import { isRecord } from '../domain/planner/save';
import { adjustedCardAmounts, summarizeCardSamples, validateStandardDeviation, type CardMath } from '../domain/events/card-statistics';

declare const self: {
  importScripts: (url: string) => void;
  math?: CardMath;
  onmessage: (event: MessageEvent<unknown>) => void;
  postMessage: (value: unknown) => void;
};

self.onmessage = (event) => {
  try {
    const request = event.data;
    if (!isRecord(request) || (request.action !== 'statistics' && request.action !== 'adjust')) throw new Error('Invalid card statistics request.');
    self.importScripts('/planner/packages/mathjs/math.js');
    if (!self.math) throw new Error('The card statistics library did not initialize.');
    const result = request.action === 'statistics'
      ? summarizeCardSamples(request.samples, self.math)
      : adjustedCardAmounts(request.statistics, validateStandardDeviation(request.deviation), self.math);
    self.postMessage({ ok: true, result });
  } catch (problem) {
    self.postMessage({ ok: false, error: problem instanceof Error ? problem.message : 'Card statistics worker failed.' });
  }
};
