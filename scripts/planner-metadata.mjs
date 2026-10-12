import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

export async function generatePlannerMetadata(root, destination) {
  const context = createContext({});
  runInContext(await readFile(join(root, 'planner', 'js', 'config.js'), 'utf8'), context);
  const metadata = runInContext(`({
    materialNames: matLookup.map,
    equipment: gearLookup,
    colours: propertyColours,
    rowColours,
    images: {},
    portraits: {},
    scribblePortraits: {},
    maxLevel: Number(inputValidation.level.max),
    fields: [
      'level', 'bond', 'star', 'ue', 'ue_level', 'ex', 'basic', 'passive', 'sub',
      'gear1', 'gear2', 'gear3', 'bond_gear', 'book_hp', 'book_atk', 'book_heal'
    ].map(key => {
      if (key === 'star') return { key, label: 'Stars', min: 1, max: 5, targetDefault: 1 };
      if (key === 'ue') return { key, label: 'UE Stars', min: 0, max: 4, targetDefault: 0 };
      const rule = inputValidation[key];
      if (!rule || !inputValidation[key + '_target']) throw new Error('Missing investment rule: ' + key);
      return { key, label: rule.name, min: Number(rule.min), max: Number(rule.max), targetDefault: inputValidation[key + '_target'].default };
    })
  })`, context);
  const plannerSource = await readFile(join(root, 'planner', 'js', 'pageLogic.js'), 'utf8');
  const globalCap = plannerSource.match(/^const globalMaxWorld = (\d+);/m);
  const cnCap = plannerSource.match(/^const cnMaxWorld = (\d+);/m);
  if (!globalCap || !cnCap) throw new Error('Farming world caps could not be read from the legacy planner.');
  metadata.worldCaps = { Global: Number(globalCap[1]), CN: Number(cnCap[1]), JP: null };
  const image = (key, folder, name) => {
    for (const filename of [`${name}.webp`, `${name}.png`, `${name}_small.webp`]) {
      if (existsSync(join(root, 'planner', 'icons', folder, filename))) {
        metadata.images[key] = `/planner/icons/${folder}/${encodeURIComponent(filename)}`;
        return;
      }
    }
  };
  for (const [id, name] of Object.entries(metadata.materialNames)) {
    const number = Number(id);
    const folder = number < 1000 ? 'Artifact' : number < 3000 ? 'Books' : number < 5000 ? 'SchoolMat' : 'Gifts';
    image(id, folder, name);
  }
  for (const name of metadata.equipment) image(name, 'Gear', name);
  for (let tier = 1; tier <= 4; tier++) {
    for (const prefix of ['XP', 'GXP']) image(`${prefix}_${tier}`, 'LevelPart', `${prefix}_${tier}`);
    for (const type of ['Spring', 'Hammer', 'Barrel', 'Needle']) image(`T${tier}_${type}`, 'LevelPart', `${type}_${tier}`);
  }
  for (const name of ['Credit', 'Eligma', 'ArenaCoin', 'JECoin', 'MasteryCertificate', 'RaidToken', 'RareRaidToken', 'EliminationRaidToken', 'RareEliminationRaidToken']) {
    image(name, 'Misc', name);
  }
  image('Xp', 'Misc', 'exp');
  image('GearXp', 'Misc', 'gxp');
  image('9999', 'Misc', 'SecretTech');
  for (const [folders, target, extension] of [
    [['Portrait'], 'portraits', 'webp'], [['Portrait', 'April'], 'scribblePortraits', 'png']
  ]) {
    for (const name of await readdir(join(root, 'planner', 'icons', ...folders))) {
      const match = name.match(new RegExp(`^Icon_(\\d+)\\.${extension}$`));
      if (match) metadata[target][match[1]] = `/planner/icons/${folders.join('/')}/${name}`;
    }
  }
  await writeFile(destination,
    `import type { PlannerMetadata } from '../src/lib/domain/planner/types';\n\n` +
    `export const metadata: PlannerMetadata = ${JSON.stringify(metadata, null, 2)};\n`
  );
}
