import type { CoreEvent, EventAmounts, EventEnergy, EventEnergySettings } from './types';

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function addFinite(left: number, right: number, label: string): number {
  return finiteNumber(left + right, label);
}

export function calculateEventBonuses(
  eventId: string,
  event: CoreEvent,
  enabled: readonly string[],
  students: Record<string, { SquadType: string }>,
): EventAmounts {
  if (eventId === 'aha-conquest') {
    return {
      Computation_Circuit: 1.2,
      Engine_Parts: 1.2,
      Chocolate_Burger: 1.2,
    };
  }
  if (eventId === 'momoyodou-beach-house') {
    return {
      Momoyodou_Glitter_Coin: 1.2,
      Turban_Shell: 1.2,
      Summer_Ninjutsu_Instructions_Scroll: 1.2,
      Local_Currency: 1.2,
    };
  }

  const bonuses: EventAmounts = {};
  for (const currencyName of Object.keys(event.currencies)) {
    let strikersUsed = 0;
    let specialsUsed = 0;
    let currencyBonus = 0;

    for (const unit of event.currencies[currencyName].bonus_units) {
      if (!enabled.includes(unit.id)) continue;

      const student = students[unit.id];
      if (!student) {
        throw new Error(`Selected bonus unit "${unit.id}" is missing from students`);
      }

      const squadType =
        student.SquadType === 'Main'
          ? 'Striker'
          : student.SquadType === 'Support'
            ? 'Special'
            : undefined;

      if (squadType === 'Striker' && strikersUsed < 4) {
        strikersUsed++;
        currencyBonus = addFinite(
          currencyBonus,
          finiteNumber(unit.bonus, `Bonus for "${unit.id}"`),
          `Bonus total for "${currencyName}"`,
        );
      }
      if (squadType === 'Special' && specialsUsed < 2) {
        specialsUsed++;
        currencyBonus = addFinite(
          currencyBonus,
          finiteNumber(unit.bonus, `Bonus for "${unit.id}"`),
          `Bonus total for "${currencyName}"`,
        );
      }
    }

    bonuses[currencyName] = currencyBonus;
  }
  return bonuses;
}

export function calculateInitialClear(
  event: CoreEvent,
): { rewards: EventAmounts; cost: number } {
  const rewards: EventAmounts = {};
  let cost = 0;

  for (const stage of event.stages) {
    if (stage.initial) {
      for (const item of Object.keys(stage.initial)) {
        const initialAmount = finiteNumber(
          stage.initial[item],
          `Initial reward "${item}"`,
        );
        if (!rewards[item]) rewards[item] = 0;
        rewards[item] = addFinite(
          rewards[item],
          initialAmount,
          `Initial reward total "${item}"`,
        );

        if (stage.drops && item in stage.drops) {
          const regularAmount = finiteNumber(
            stage.drops[item],
            `Regular drop "${item}"`,
          );
          if (regularAmount) {
            rewards[item] = addFinite(
              rewards[item],
              regularAmount,
              `Initial reward total "${item}"`,
            );
          }
        }
      }
    }

    const stageCost = finiteNumber(stage.cost, 'Event stage cost');
    if (stageCost < 0) throw new Error('Event stage cost cannot be negative');
    cost = addFinite(cost, stageCost, 'Initial clear cost');
  }

  return { rewards, cost };
}

export function calculateEventEnergy(
  eventId: string,
  event: CoreEvent,
  settings: EventEnergySettings,
  cafeEnergy: Record<string, number>,
  midEvent: boolean,
  initialClearCost: number,
  nowMs: number,
  defaultCafeRank = 10,
): EventEnergy {
  const resetTime = finiteNumber(event.reset_time, 'Event reset time');
  const startTime = finiteNumber(event.start_time, 'Event start time');
  const endTime = finiteNumber(event.end_time, 'Event end time');
  const maintenanceHours = finiteNumber(event.maint_hours, 'Event maintenance hours');
  finiteNumber(nowMs, 'Current time');
  finiteNumber(initialClearCost, 'Initial clear cost');

  const cafeRank = finiteNumber(
    settings.cafe_rank ?? defaultCafeRank,
    'Cafe rank',
  );
  const cafeRate = cafeEnergy[String(cafeRank)];
  if (cafeRate === undefined) {
    throw new Error(`Missing cafe energy rate for rank "${cafeRank}"`);
  }
  finiteNumber(cafeRate, `Cafe energy rate for rank "${cafeRank}"`);

  const pyroRefreshes = finiteNumber(settings.pyro_refreshes ?? 0, 'Pyro refreshes');
  const pvpRefreshes = finiteNumber(settings.pvp_refreshes ?? 0, 'PvP refreshes');
  const storedCarryover = finiteNumber(
    settings.energy_carryover ?? 0,
    'Energy carryover',
  );

  let daysPassed = 0;
  if (midEvent) {
    const elapsedDays = finiteNumber(
      (nowMs / 1000 - resetTime) / 86400,
      'Elapsed event days',
    );
    daysPassed = finiteNumber(Math.floor(elapsedDays) + 1, 'Days passed');
  }

  let naturalTotal = 0;
  let cafeTotal = 0;
  let dailyTotal = 0;
  let clubTotal = 0;
  let pyroTotal = 0;
  let pvpTotal = 0;
  let packTotal = 0;
  const energyByDay: number[] = [];

  let resets = daysPassed;
  let dayStart = finiteNumber(
    resetTime + daysPassed * 86400,
    'First event reset time',
  );
  while (dayStart < endTime) {
    let dayLength = 24;
    let carryover = 0;

    if (resets === 0) {
      dayLength = finiteNumber(
        (((resetTime + 86400) - startTime) / 3600) - maintenanceHours,
        'First event day length',
      );
      if (!midEvent) carryover = storedCarryover;
    } else if (
      finiteNumber(dayStart + 86400, 'Next event reset time') > endTime
    ) {
      dayLength = finiteNumber(
        (endTime - resetTime - 86400 * resets) / 3600,
        'Last event day length',
      );
    }

    const natural = finiteNumber(10 * dayLength, 'Natural energy');
    const cafe = finiteNumber(Math.floor(cafeRate * dayLength), 'Cafe energy');
    const daily = 150;
    const club = 10;
    const pyro = finiteNumber(120 * pyroRefreshes, 'Pyro refresh energy');
    const pvp = finiteNumber(90 * pvpRefreshes, 'PvP refresh energy');
    const pack = settings.energy_pack ? 150 : 0;

    naturalTotal = addFinite(naturalTotal, natural, 'Natural energy total');
    cafeTotal = addFinite(cafeTotal, cafe, 'Cafe energy total');
    dailyTotal = addFinite(dailyTotal, daily, 'Daily task energy total');
    clubTotal = addFinite(clubTotal, club, 'Club energy total');
    pyroTotal = addFinite(pyroTotal, pyro, 'Pyro refresh energy total');
    pvpTotal = addFinite(pvpTotal, pvp, 'PvP refresh energy total');
    packTotal = addFinite(packTotal, pack, 'Energy pack total');

    const dayEnergy = finiteNumber(
      natural + cafe + daily + club + pyro + pvp + pack + carryover,
      'Daily energy',
    );
    energyByDay[resets] = dayEnergy;

    const nextDayStart = finiteNumber(dayStart + 86400, 'Next event reset time');
    const nextResets = finiteNumber(resets + 1, 'Event reset count');
    if (nextDayStart <= dayStart || nextResets === resets) {
      throw new Error('Event timing is too large to calculate safely');
    }
    dayStart = nextDayStart;
    resets = nextResets;
  }

  const resetsLeft = finiteNumber(Math.max(resets - daysPassed, 0), 'Resets left');
  if (energyByDay.length === 0) {
    throw new Error('No event energy days available');
  }
  const dailyEnergy = energyByDay.reduce((total, amount) =>
    addFinite(total, amount, 'Total event energy'),
  );
  const totalEnergy = finiteNumber(
    dailyEnergy + 500 + 150,
    'Total event energy',
  );
  const reserve = eventId === 'momoyodou-beach-house' && !midEvent ? 900 : 100;
  const available = finiteNumber(
    Math.max(totalEnergy - reserve - initialClearCost, 0),
    'Available event energy',
  );

  return {
    sources: {
      natural: naturalTotal,
      cafe: cafeTotal,
      daily: dailyTotal,
      club: clubTotal,
      pyro: pyroTotal,
      pvp: pvpTotal,
      pack: packTotal,
      carryover: storedCarryover,
      weekly: 500,
      arona: 150,
    },
    total: totalEnergy,
    available,
    resetsLeft,
    resetsTotal: resets,
  };
}
