import type { BoxEvent, BoxRewards } from './standard-types';
import type { EventAmounts } from './types';
import { isRecord } from '../planner/save';

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
interface CycleSummary {
  artifacts: Map<string, number>;
  schoolMats: Map<string, number>;
  eleph: Map<string, number>;
  xps: Map<string, number>;
  credit: number;
  eligma: number;
  secretTech: number;
  currency: number;
  currencyName: string;
}

interface ExplicitCycle { cycle: number; setIndex: number }
interface BoxData {
  clearCost: number;
  summaries: CycleSummary[];
  repeatIndex: number;
  explicitCycles: ExplicitCycle[];
}

function nonnegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_SAFE) {
    throw new Error(`${label} must be a finite, non-negative number within the safe range.`);
  }
  return value;
}
function nonnegativeInteger(value: unknown, label: string): number {
  const result = nonnegativeNumber(value, label);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} must be a non-negative safe integer.`);
  return result;
}
function addSafe(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range.`);
  return result;
}
function multiplySafe(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range.`);
  return result;
}
function addToMap(target: Map<string, number>, key: string, value: number, label: string): void {
  target.set(key, addSafe(target.get(key) ?? 0, value, label));
}
function emptySummary(): CycleSummary {
  return {
    artifacts: new Map(), schoolMats: new Map(), eleph: new Map(), xps: new Map(),
    credit: 0, eligma: 0, secretTech: 0, currency: 0, currencyName: ''
  };
}
function summarizeRewards(rewards: unknown): CycleSummary {
  if (!Array.isArray(rewards)) throw new Error('Box rewards must be an array.');
  const summary = emptySummary();
  for (const reward of rewards) {
    if (!isRecord(reward)) throw new Error('A box reward must be a record.');
    const { type, id } = reward;
    if (typeof type !== 'string' || type.length === 0) throw new Error('A box reward needs a type.');
    if (!((typeof id === 'string' && id.length > 0) ||
      (typeof id === 'number' && Number.isSafeInteger(id)))) {
      throw new Error(`Box reward "${type}" needs a valid id.`);
    }
    const count = nonnegativeInteger(reward.count, `Count for box reward "${type}"`);
    const amount = nonnegativeInteger(reward.amount, `Amount for box reward "${type}"`);
    const key = String(id);

    if (type === 'XpReport' || type === 'XpOrb') {
      addToMap(summary.xps, key, count, 'Box XP total');
    } else if (type === 'Eligma') {
      summary.eligma = addSafe(summary.eligma, count, 'Box eligma total');
    } else if (type === 'Credit') {
      summary.credit = addSafe(summary.credit, multiplySafe(amount, count, 'Box credit reward'), 'Box credit total');
    } else if (type === 'SecretTech') {
      summary.secretTech = addSafe(summary.secretTech, count, 'Box secret tech total');
    } else if (type === 'Material') {
      const materialId = Number.parseInt(String(id));
      if (!Number.isSafeInteger(materialId)) throw new Error(`Box material id "${key}" is invalid.`);
      if (materialId < 1000) addToMap(summary.artifacts, String(materialId), count, 'Box artifact total');
      else if (materialId < 5000) addToMap(summary.schoolMats, String(materialId), count, 'Box school material total');
    } else if (type === 'Eleph') {
      addToMap(summary.eleph, key, multiplySafe(amount, count, 'Box eleph reward'), 'Box eleph total');
    } else if (type === 'EventCurrency') {
      if (summary.currencyName === '') summary.currencyName = key;
      summary.currency = addSafe(summary.currency, multiplySafe(amount, count, 'Box currency reward'), 'Box currency total');
    }
  }
  return summary;
}
function prepare(event: BoxEvent): BoxData {
  if (!isRecord(event) || !Array.isArray(event.boxes) || event.boxes.length === 0) {
    throw new Error('A box event must define at least one box cycle set.');
  }
  const clearCost = nonnegativeNumber(event.box_clear_cost, 'Box clear cost');
  if (clearCost === 0) throw new Error('Box clear cost must be greater than zero.');
  const cycleToSet = new Map<string, number>();
  const summaries: CycleSummary[] = [];
  for (let setIndex = 0; setIndex < event.boxes.length; setIndex++) {
    const box = event.boxes[setIndex];
    if (!isRecord(box) || !Array.isArray(box.cycle) || box.cycle.length === 0 || !Array.isArray(box.rewards)) {
      throw new Error('Each box cycle set needs cycle labels and rewards.');
    }
    for (const cycle of box.cycle) {
      if (typeof cycle !== 'string' || !/^[1-9]\d*$/.test(cycle) ||
        !Number.isSafeInteger(Number(cycle)) || String(Number(cycle)) !== cycle) {
        throw new Error('Box cycle labels must be positive safe integer strings.');
      }
      // Legacy selects the repeat set using the number of unique cycle labels.
      cycleToSet.set(cycle, setIndex);
    }
    summaries.push(summarizeRewards(box.rewards));
  }
  const repeatIndex = cycleToSet.get(String(cycleToSet.size));
  if (repeatIndex === undefined) throw new Error('Box cycles do not define a repeat mapping.');
  const explicitCycles = [...cycleToSet].map(([cycle, setIndex]) => ({ cycle: Number(cycle), setIndex }));
  explicitCycles.sort((left, right) => left.cycle - right.cycle);
  return { clearCost, summaries, repeatIndex, explicitCycles };
}
function validateTarget(targetCurrency: number): number {
  return nonnegativeNumber(targetCurrency, 'Target currency');
}
function boxesNeededFor(data: BoxData, target: number): number {
  if (target === 0) return 0;
  let obtained = 0;
  let nextCycle = 1;
  const repeatCurrency = data.summaries[data.repeatIndex].currency;

  const repeatSegment = (start: number, count: number | null): { obtained: number; reached?: number } => {
    if (count === 0 || repeatCurrency === 0) return { obtained };
    const needed = Math.ceil((target - obtained) / repeatCurrency);
    if (count === null || needed <= count) {
      const cycle = start + needed - 1;
      if (!Number.isSafeInteger(cycle)) throw new Error('Required box count exceeds the safe integer range.');
      const total = addSafe(obtained, multiplySafe(repeatCurrency, needed, 'Box currency total'), 'Box currency total');
      return { obtained: total, reached: cycle };
    }
    return {
      obtained: addSafe(obtained, multiplySafe(repeatCurrency, count, 'Box currency total'), 'Box currency total')
    };
  };

  for (const entry of data.explicitCycles) {
    const gap = entry.cycle - nextCycle;
    const repeated = repeatSegment(nextCycle, gap);
    if (repeated.reached !== undefined) return repeated.reached;
    obtained = repeated.obtained;
    obtained = addSafe(obtained, data.summaries[entry.setIndex].currency, 'Box currency total');
    if (obtained >= target) return entry.cycle;
    if (entry.cycle === MAX_SAFE) throw new Error('Required box count exceeds the safe integer range.');
    nextCycle = entry.cycle + 1;
  }
  const repeated = repeatSegment(nextCycle, null);
  if (repeated.reached !== undefined) return repeated.reached;
  throw new Error('The target box currency is unreachable because the repeat cycle yields no currency.');
}

function clearsForPull(data: BoxData, pullCurrency: number): number {
  const pull = nonnegativeNumber(pullCurrency, 'Box pull currency');
  const clears = Math.floor(pull / data.clearCost);
  if (!Number.isSafeInteger(clears)) throw new Error('Box clear count exceeds the safe integer range.');
  return clears;
}

function forEachCycleSegment(data: BoxData, clears: number, visit: (setIndex: number, count: number) => void): void {
  let nextCycle = 1;
  for (const entry of data.explicitCycles) {
    if (entry.cycle > clears) break;
    const repeatCount = entry.cycle - nextCycle;
    if (repeatCount > 0) visit(data.repeatIndex, repeatCount);
    visit(entry.setIndex, 1);
    nextCycle = entry.cycle + 1;
  }
  if (nextCycle <= clears) visit(data.repeatIndex, clears - nextCycle + 1);
}

function currencyThrough(data: BoxData, clears: number): number {
  let total = 0;
  forEachCycleSegment(data, clears, (setIndex, count) => {
    const currency = multiplySafe(data.summaries[setIndex].currency, count, 'Box currency total');
    total = addSafe(total, currency, 'Box currency total');
  });
  return total;
}

function addScaled(target: Map<string, number>, source: Map<string, number>, count: number, label: string): void {
  for (const [key, value] of source) addToMap(target, key, multiplySafe(value, count, label), label);
}

function namedMaterials(amounts: Map<string, number>, names: Record<string, string>): EventAmounts {
  const result = new Map<string, number>();
  for (const [id, count] of amounts) {
    const name = names[id];
    if (typeof name !== 'string' || name.length === 0) throw new Error(`No material name is defined for id "${id}".`);
    addToMap(result, name, count, 'Box material total');
  }
  return Object.fromEntries(result);
}

export function boxesNeeded(event: BoxEvent, targetCurrency: number): number {
  return boxesNeededFor(prepare(event), validateTarget(targetCurrency));
}

export function boxPullCurrencyNeeded(event: BoxEvent, targetCurrency: number): number {
  const data = prepare(event);
  const needed = boxesNeededFor(data, validateTarget(targetCurrency));
  const result = needed * data.clearCost;
  if (!Number.isFinite(result) || result > MAX_SAFE) throw new Error('Required pull currency exceeds the safe range.');
  return result;
}

export function boxCurrencyObtained(event: BoxEvent, pullCurrency: number): number {
  const data = prepare(event);
  return currencyThrough(data, clearsForPull(data, pullCurrency));
}

export function boxRewards(event: BoxEvent, pullCurrency: number, materialNames: Record<string, string>): BoxRewards {
  const data = prepare(event);
  if (!isRecord(materialNames)) throw new Error('Material names must be a record.');
  const pull = nonnegativeNumber(pullCurrency, 'Box pull currency');
  const clears = clearsForPull(data, pull);
  const leftoverPercent = ((pull - clears * data.clearCost) / data.clearCost * 100).toFixed(0);
  const total = emptySummary();

  forEachCycleSegment(data, clears, (setIndex, count) => {
    const summary = data.summaries[setIndex];
    total.credit = addSafe(total.credit, multiplySafe(summary.credit, count, 'Box credit total'), 'Box credit total');
    total.eligma = addSafe(total.eligma, multiplySafe(summary.eligma, count, 'Box eligma total'), 'Box eligma total');
    total.secretTech = addSafe(total.secretTech, multiplySafe(summary.secretTech, count, 'Box secret tech total'), 'Box secret tech total');
    total.currency = addSafe(total.currency, multiplySafe(summary.currency, count, 'Box currency total'), 'Box currency total');
    addScaled(total.artifacts, summary.artifacts, count, 'Box artifact total');
    addScaled(total.schoolMats, summary.schoolMats, count, 'Box school material total');
    addScaled(total.eleph, summary.eleph, count, 'Box eleph total');
    addScaled(total.xps, summary.xps, count, 'Box XP total');
    if (total.currencyName === '' && summary.currencyName !== '') total.currencyName = summary.currencyName;
  });

  return {
    clears, leftoverPercent,
    artifacts: namedMaterials(total.artifacts, materialNames),
    schoolMats: namedMaterials(total.schoolMats, materialNames),
    eleph: Object.fromEntries(total.eleph),
    xps: Object.fromEntries(total.xps),
    credit: total.credit, eligma: total.eligma, secretTech: total.secretTech,
    currency: total.currency, currencyName: clears === 0 ? '' : total.currencyName
  };
}
