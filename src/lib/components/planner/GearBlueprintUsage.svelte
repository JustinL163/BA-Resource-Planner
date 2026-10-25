<script lang="ts">
  import { farmedGeneralConversions, type GearFarmData, type GearFarmPlan } from '$lib/domain/planner/gear-farm';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import type { PlannerMetadata } from '$lib/domain/planner/types';

  let { data, metadata, result, t }: {
    data: GearFarmData; metadata: PlannerMetadata; result: GearFarmPlan; t: (id: string) => string;
  } = $props();
  let conversions = $derived(farmedGeneralConversions(result, data));
  let conversionGroups = $derived.by(() => {
    const types = [...new Set(metadata.equipment.map((key) => key.split('_')[1]))];
    return types.flatMap((type) => {
      const general = `G_${type}`;
      const targets = conversions.filter((conversion) => conversion.general === general);
      return targets.length ? [{ type, general, targets, amount: targets.reduce((sum, conversion) => sum + conversion.farmed + conversion.owned, 0) }] : [];
    });
  });
  const gearName = (key: string) => {
    const [tier, type] = key.split('_');
    return `${tier} ${t(`gear-${type.toLowerCase()}`)}`;
  };
</script>

{#if conversions.length}
  <section class="general-conversions" aria-label={t('ui-farming-general-conversions')}>
    <h3>{t('ui-farming-general-conversions')}</h3>
    <ul class="conversion-groups">
      {#each conversionGroups as group (group.general)}
        <li class="conversion-group" data-farm-conversion-type={group.type} aria-label={t(`gear-${group.type.toLowerCase()}`)}>
          <div class="conversion-source" title={`${t('gear-general-blueprint')}: ${formatAmount(group.amount)}`}>
            <img src={`/planner/icons/Gear/${group.general}.png`} alt={t('gear-general-blueprint')} loading="lazy" draggable="false" />
            <strong data-farm-general-used>{formatAmount(group.amount)}</strong>
          </div>
          <ul class="conversion-targets">
            {#each group.targets as conversion (conversion.gear)}
              {@const item = resourceItem(conversion.gear, metadata)}
              <li class="conversion-target" data-farm-conversion={conversion.gear}
                title={`${gearName(conversion.gear)}: ${formatAmount(conversion.blueprints)}`}
                aria-label={`${gearName(conversion.gear)}: ${formatAmount(conversion.blueprints)}`}>
                {#if item.image}<img src={item.image} alt="" loading="lazy" draggable="false" />{/if}
                <strong data-farm-converted-blueprints>{formatAmount(conversion.blueprints)}</strong>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .general-conversions { width: 100%; min-width: 0; margin-top: 0.75rem; }
  h3 { margin: 0 0 0.4rem; font-size: 0.9rem; }
  ul { display: flex; flex-wrap: wrap; margin: 0; padding: 0; list-style: none; }
  .conversion-groups { align-items: flex-start; gap: 0.4rem; }
  .conversion-group { display: flex; flex-direction: column; gap: 0.1rem; width: max-content; max-width: 100%; min-width: 0; box-sizing: border-box; padding: 0.2rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); }
  .conversion-source { display: flex; justify-content: center; align-items: center; gap: 0.2rem; }
  .conversion-source img { width: 2rem; height: 2rem; object-fit: contain; }
  .conversion-source strong { font-size: 0.9rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .conversion-targets { gap: 0.1rem; }
  .conversion-target { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; min-width: 2.5rem; }
  .conversion-target img { width: 2.5rem; height: 2.5rem; object-fit: contain; }
  .conversion-target strong { font: 700 0.8rem/1.1 sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }
  :global(.site[data-theme="dark"]) img { filter: brightness(0.9); }
  @media (max-width: 600px) {
    .conversion-target { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; min-width: 2rem; }
    .conversion-target img { width: 2rem; height: 2rem; object-fit: contain; }
    .conversion-target strong { font: 700 0.6rem/1.1 sans-serif; }
  }
</style>
