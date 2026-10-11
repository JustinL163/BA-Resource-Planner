export const guesserCategories = [
  'Halos', 'Weapons', 'Chocolates', 'Silhouettes', 'Surnames', 'Ages', 'Birthdays', 'Heights'
] as const;

export type GuesserCategory = (typeof guesserCategories)[number];
export type GuesserInput = 'Freeform' | 'MultiChoice';
export type GuesserColour = 'Colour' | 'Grayscale';
export type GuesserDateMode = 'Month' | 'Date';
export type GuesserConsciousState = 'Awake' | 'Sleeping';
export type GuesserAnswer = string | number;

export interface GuesserStudent {
  name?: string;
  released?: boolean;
  altnames?: string[];
  alts?: Array<string | number>;
  weapons?: Array<string | number>;
  chocolate?: boolean;
  choices?: string[];
  surname?: string;
  age?: string | number;
  birthday?: string;
  height?: number;
}

export interface GuesserData { halos: Record<string, GuesserStudent> }
export interface GuesserQuestion extends GuesserStudent { id: string; weapon?: string | number; alt?: string | number }

export interface GuesserSettings {
  category: GuesserCategory;
  input: GuesserInput;
  timeLimit: number | null;
  maxGuesses: number;
  colour: GuesserColour;
  lenience: 0 | 1 | 3;
  dateMode: GuesserDateMode;
  conscious: GuesserConsciousState;
}

export const defaultGuesserSettings: GuesserSettings = {
  category: 'Halos', input: 'Freeform', timeLimit: null, maxGuesses: 1, colour: 'Colour', lenience: 3,
  dateMode: 'Date', conscious: 'Sleeping'
};

const months = [
  ['January', 'jan'], ['February', 'feb'], ['March', 'mar'], ['April', 'apr'], ['May', 'may'], ['June', 'jun'],
  ['July', 'jul'], ['August', 'aug'], ['September', 'sep'], ['October', 'oct'], ['November', 'nov'], ['December', 'dec']
] as const;

const characters: GuesserCategory[] = ['Halos', 'Weapons', 'Chocolates', 'Silhouettes'];

export function createQuestionPool(data: GuesserData, category: GuesserCategory): GuesserQuestion[] {
  const questions: GuesserQuestion[] = [];
  for (const [id, student] of Object.entries(data.halos)) {
    if (category === 'Halos' && student.released) questions.push({ ...student, id });
    else if (category === 'Weapons') {
      for (const weapon of student.weapons ?? []) questions.push({ ...student, id, weapon });
    } else if (category === 'Chocolates' && student.chocolate) questions.push({ ...student, id });
    else if (category === 'Silhouettes') {
      for (const alt of student.alts ?? []) questions.push({ ...student, id, alt });
    } else if (student.released && ['Surnames', 'Ages', 'Birthdays', 'Heights'].includes(category)) {
      questions.push({ ...student, id });
    }
  }
  return questions;
}

export function shuffleQuestions<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length; index > 0; index--) {
    const other = Math.floor(random() * index);
    [result[index - 1], result[other]] = [result[other], result[index - 1]];
  }
  return result;
}

export function answerFor(question: GuesserQuestion, settings: GuesserSettings): GuesserAnswer {
  switch (settings.category) {
    case 'Halos': case 'Weapons': case 'Chocolates': case 'Silhouettes': return question.name ?? '';
    case 'Surnames': return question.surname ?? '';
    case 'Ages': return question.age ?? '';
    case 'Heights': return question.height ?? '';
    case 'Birthdays': {
      const birthday = question.birthday ?? '';
      return settings.dateMode === 'Month' ? birthday.slice(0, birthday.indexOf(' ')) : birthday;
    }
  }
}

function monthMatches(value: string): boolean {
  const normalised = value.toLowerCase();
  return months.some(([name, short]) => normalised === name.toLowerCase() || normalised === short);
}

export function allowedAnswer(value: string, questions: readonly GuesserQuestion[], settings: GuesserSettings): boolean {
  let answer: GuesserAnswer = value.toLowerCase();
  if (/^\d*$/i.test(answer)) {
    if (!answer) return false;
    answer = Number.parseInt(answer, 10);
  }

  const allowed = new Set<GuesserAnswer>();
  if (characters.includes(settings.category)) {
    for (const question of questions) {
      if (question.name) allowed.add(question.name.toLowerCase());
      for (const alias of question.altnames ?? []) allowed.add(alias.toLowerCase());
    }
  } else if (settings.category === 'Surnames') {
    for (const question of questions) if (question.surname) allowed.add(question.surname.toLowerCase());
  } else if (settings.category === 'Ages') {
    for (const question of questions) {
      if (question.age !== undefined) allowed.add(typeof question.age === 'string' ? question.age.toLowerCase() : question.age);
    }
  } else if (settings.category === 'Birthdays') {
    for (const [name, short] of months) { allowed.add(name.toLowerCase()); allowed.add(short); }
  } else if (settings.category === 'Heights') {
    for (let height = 128; height < 180; height++) allowed.add(height);
  }
  if (allowed.has(answer)) return true;

  if (settings.category === 'Birthdays' && settings.dateMode === 'Date') {
    const match = /^([^ ]+) ([0-9]+)$/.exec(value.toLowerCase());
    return !!match && monthMatches(match[1]) && Array.from({ length: 31 }, (_unused, index) => String(index + 1)).includes(match[2]);
  }
  return false;
}

export type GuessResult = 'correct' | 'half-correct' | 'wrong';

export function evaluateAnswer(
  question: GuesserQuestion, value: string, settings: GuesserSettings
): GuessResult {
  const answer = value.toLowerCase();
  if (characters.includes(settings.category)) {
    if (question.name?.toLowerCase() === answer || (question.altnames ?? []).some((name) => name.toLowerCase() === answer)) return 'correct';
  } else if (settings.category === 'Surnames' && question.surname?.toLowerCase() === answer) return 'correct';
  else if (settings.category === 'Ages' && String(question.age).toLowerCase() === answer) return 'correct';
  else if (settings.category === 'Heights') {
    const guessed = Number(answer);
    if (question.height === guessed) return 'correct';
    if (settings.input === 'Freeform' && Number.isFinite(guessed) && Math.abs((question.height ?? Number.NaN) - guessed) <= settings.lenience) return 'half-correct';
  } else if (settings.category === 'Birthdays') {
    const birthday = question.birthday ?? '';
    const monthEnd = birthday.indexOf(' ');
    const fullMonth = birthday.slice(0, monthEnd).toLowerCase();
    const monthShort = fullMonth.slice(0, 3);
    if (settings.dateMode === 'Month' && (fullMonth === answer || monthShort === answer)) return 'correct';
    if (settings.dateMode === 'Date') {
      const split = answer.indexOf(' ');
      if (split > 0 && (fullMonth === answer.slice(0, split) || monthShort === answer.slice(0, split)) &&
          birthday.slice(monthEnd + 1) === answer.slice(split + 1)) return 'correct';
    }
  }
  return 'wrong';
}

export function choiceValue(question: GuesserQuestion, settings: GuesserSettings): GuesserAnswer {
  return answerFor(question, settings);
}

export function createChoices(
  question: GuesserQuestion, questions: readonly GuesserQuestion[], settings: GuesserSettings,
  random: () => number = Math.random
): GuesserAnswer[] {
  const choices: GuesserAnswer[] = [choiceValue(question, settings)];
  const target = Math.min(4, questions.length);
  let attempts = 0;
  while (choices.length < target && attempts < questions.length * 20) {
    attempts++;
    const candidate = choiceValue(questions[Math.floor(random() * questions.length)], settings);
    if (!choices.includes(candidate)) choices.push(candidate);
  }
  return shuffleQuestions(choices, random);
}

export function imageFor(question: GuesserQuestion, settings: GuesserSettings): string {
  switch (settings.category) {
    case 'Halos': return `/planner/icons/Halo/${question.id}.webp`;
    case 'Weapons': return `/planner/icons/UE/weapon_icon_${question.weapon}.webp`;
    case 'Chocolates': return `/game/chocolate/${question.id}.webp`;
    case 'Silhouettes': return settings.conscious === 'Sleeping'
      ? `/game/sleeping/${question.alt}.webp`
      : `/planner/icons/splashart/${question.alt}.webp`;
    case 'Surnames': case 'Ages': case 'Birthdays': case 'Heights':
      return `/planner/icons/splashart/${question.alts?.[0]}.webp`;
  }
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes}:${remaining < 10 ? `0${remaining.toFixed(2)}` : remaining.toFixed(2)}`;
}

export function cyrb53(value: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let index = 0, character; index < value.length; index++) {
    character = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ character, 2654435761);
    h2 = Math.imul(h2 ^ character, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export interface GuessRecord {
  score: number;
  time: string;
  correct: number;
  wrong: number;
  title: string;
  string: number;
}

export type GuessRecords = Record<string, unknown>;

export function recordHash(record: Pick<GuessRecord, 'score' | 'time' | 'correct' | 'wrong' | 'title'>): number {
  return cyrb53(`${record.score}${record.time}${record.correct}${record.wrong}${record.title}`);
}

export function recordIsValid(record: unknown): record is GuessRecord {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return false;
  const candidate = record as Partial<GuessRecord>;
  if (!('score' in candidate) || !('time' in candidate) || !('correct' in candidate) || !('wrong' in candidate) ||
      !('title' in candidate) || !('string' in candidate)) return false;
  return String(candidate.string) === String(recordHash(candidate as GuessRecord));
}

export interface ScoreSettings extends Pick<GuesserSettings, 'category' | 'input' | 'timeLimit' | 'maxGuesses' | 'colour' | 'lenience' | 'dateMode' | 'conscious'> {}

export function calculateScore(correct: number, questionCount: number, elapsedSeconds: number, settings: ScoreSettings): number {
  const baseScores = [2108000, 4216000, 10160000, 21016000, 31708000];
  const timeScores = [1728000, 3456000, 5184000, 6912000, 8640000];
  let difficulty: number;
  if ((settings.input === 'Freeform' && settings.timeLimit === 3 && settings.maxGuesses === 1) ||
      (settings.input === 'MultiChoice' && settings.timeLimit === 1.5)) difficulty = 4;
  else if ((settings.input === 'Freeform' && settings.timeLimit === 10 && settings.maxGuesses === 1) ||
      (settings.input === 'MultiChoice' && settings.timeLimit === 3)) difficulty = 3;
  else if ((settings.input === 'Freeform' && settings.timeLimit === 10) ||
      (settings.input === 'MultiChoice' && settings.timeLimit === 10)) difficulty = 2;
  else if ((settings.input === 'Freeform' && !settings.timeLimit && settings.maxGuesses === 1) || settings.input === 'MultiChoice') difficulty = 1;
  else difficulty = 0;

  const baseScore = baseScores[difficulty] * (Math.pow(correct, 2) / 10000);
  const maxTimeRoot = Math.sqrt(questionCount * 30);
  const minTimeRoot = Math.sqrt(questionCount);
  const timeRatio = Math.min(Math.max((Math.sqrt(elapsedSeconds) - minTimeRoot) / (maxTimeRoot - minTimeRoot), 0), 1);
  const timeScore = timeScores[difficulty] - timeScores[difficulty] * timeRatio;
  const colourModifier = ['Halos', 'Weapons', 'Chocolates'].includes(settings.category) && settings.colour === 'Grayscale' ? 1.05 : 1;
  const consciousModifier = settings.category === 'Silhouettes' && settings.conscious === 'Sleeping' ? 1.05 : 1;
  const dateModifier = settings.category === 'Birthdays' && settings.dateMode === 'Date' ? 1.2 : 1;
  const heightModifier = settings.category === 'Heights' && settings.lenience === 1 ? 1.05 :
    settings.category === 'Heights' && settings.lenience === 0 ? 1.1 : 1;
  return Math.ceil((baseScore + timeScore) * colourModifier * consciousModifier * dateModifier * heightModifier);
}

export function scoreTitle(settings: GuesserSettings): string {
  let title = `${settings.category} ${settings.input.substring(0, 1)} ${settings.timeLimit ?? 0}s `;
  if (settings.input === 'Freeform') title += `${settings.maxGuesses} `;
  if (['Halos', 'Weapons', 'Chocolates'].includes(settings.category)) title += settings.colour.substring(0, 1);
  else if (settings.category === 'Birthdays') title += settings.dateMode.substring(0, 1);
  else if (settings.category === 'Heights' && settings.input === 'Freeform') title += `${settings.lenience}cm`;
  else if (settings.category === 'Silhouettes') title += settings.conscious.substring(0, 1);
  return title;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
