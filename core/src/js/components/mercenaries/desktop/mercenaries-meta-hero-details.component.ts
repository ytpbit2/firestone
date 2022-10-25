import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CardsFacadeService } from '../../../services/cards-facade.service';
import {
	MercenariesHeroStat,
	MercenariesReferenceData,
} from '../../../services/mercenaries/mercenaries-state-builder.service';
import { getHeroRole, normalizeMercenariesCardId } from '../../../services/mercenaries/mercenaries-utils';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { filterMercenariesHeroStats, filterMercenariesRuns } from '../../../services/ui-store/mercenaries-ui-helper';
import { groupByFunction, sumOnArray } from '../../../services/utils';
import { AbstractSubscriptionComponent } from '../../abstract-subscription.component';
import { MercenaryAbility, MercenaryEquipment, MercenaryInfo } from './mercenary-info';

@Component({
	selector: 'mercenaries-meta-hero-details',
	styleUrls: [
		`../../../../css/global/components-global.scss`,
		`../../../../css/component/mercenaries/desktop/mercenaries-meta-hero-details.component.scss`,
	],
	template: `
		<div class="mercenaries-hero-details" *ngIf="heroStats$ | async as stats">
			<div class="player-overview">
				<div class="background-additions">
					<div class="top"></div>
					<div class="bottom"></div>
				</div>
				<div class="portrait" [cardTooltip]="stats.id">
					<img class="icon" [src]="buildPortraitArtUrl(stats.id)" />
					<img class="frame" [src]="buildPortraitFrameUrl(stats.role)" />
				</div>
				<div class="player-info">
					<div class="hero-detailed-stats">
						<!-- <div class="title">General stats</div> -->
						<div class="content">
							<div class="stat">
								<div class="header" [owTranslate]="'mercenaries.hero-stats.games-played'"></div>
								<div class="values">
									<div class="my-value">{{ stats.playerTotalMatches }}</div>
								</div>
							</div>
							<div class="stat">
								<div class="header" [owTranslate]="'mercenaries.hero-stats.winrate'"></div>
								<div class="values">
									<div
										class="my-value percent"
										[ngClass]="{
											'positive': stats.playerWinrate && stats.playerWinrate > 50,
											'negative': stats.playerWinrate && stats.playerWinrate < 50
										}"
									>
										{{ buildValuePercent(stats.playerWinrate, 0) }}
									</div>
									<bgs-global-value
										[value]="buildValuePercent(stats.globalWinrate)"
									></bgs-global-value>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="equipment-overview">
				<div class="equipment-header" [owTranslate]="'mercenaries.hero-stats.equipments'"></div>
				<div class="equipment-content">
					<div class="equipment-item" *ngFor="let equipment of stats.equipment">
						<div class="equipment-item-icon" [cardTooltip]="equipment.cardId">
							<img class="icon" [src]="buildEquipmentArtUrl(equipment.cardId)" />
							<img
								class="frame"
								src="https://static.zerotoheroes.com/hearthstone/asset/firestone/mercenaries_equipment_frame.png"
							/>
						</div>
						<!-- <div class="equipment-item-name">{{ equipment.name }}</div> -->
						<div class="equipment-item-stats">
							<div class="item winrate">
								<div class="label" [owTranslate]="'mercenaries.hero-stats.global-winrate'"></div>
								<div class="values">
									<div class="value player">{{ buildValuePercent(equipment.globalWinrate) }}</div>
								</div>
							</div>
							<div class="item winrate">
								<div class="label" [owTranslate]="'mercenaries.hero-stats.your-winrate'"></div>
								<div class="values">
									<div class="value player">
										{{
											equipment.playerWinrate != null
												? buildValuePercent(equipment.playerWinrate)
												: '--'
										}}
									</div>
								</div>
							</div>
							<div class="stats">
								<div class="item popularity">
									<div class="label" [owTranslate]="'mercenaries.hero-stats.games-played'"></div>
									<div class="values">
										<div class="value player">{{ buildValue(equipment.playerGamesPlayed, 0) }}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="abilities-overview">
				<div class="ability-header" [owTranslate]="'mercenaries.hero-stats.abilities'"></div>
				<div class="ability-content">
					<div class="ability-item" *ngFor="let ability of stats.abilities">
						<div class="ability-item-icon" [cardTooltip]="ability.cardId" cardTooltipPosition="top-right">
							<img class="icon" [src]="buildAbilityArtUrl(ability.cardId)" />
							<img
								class="frame"
								src="https://static.zerotoheroes.com/hearthstone/asset/firestone/mercenaries_ability_frame.png"
							/>
							<div class="speed">
								<div class="value">{{ ability.speed }}</div>
							</div>
							<div class="cooldown" *ngIf="!!ability.cooldown">
								<img
									class="cooldown-icon"
									src="https://static.zerotoheroes.com/hearthstone/asset/firestone/mercenaries_cooldown.png"
								/>
								<div class="value">{{ ability.cooldown }}</div>
							</div>
						</div>
						<!-- <div class="equipment-item-name">{{ equipment.name }}</div> -->
						<div class="ability-item-stats">
							<div class="item winrate">
								<div
									class="label"
									[helpTooltip]="'mercenaries.hero-stats.global-usage-tooltip' | owTranslate"
									[owTranslate]="'mercenaries.hero-stats.global-usage'"
								></div>
								<div class="values">
									<div class="value player">{{ buildValue(ability.globalUsePerMatch, 2) }}</div>
								</div>
							</div>
							<div class="item winrate">
								<div
									class="label"
									[helpTooltip]="'mercenaries.hero-stats.your-usage-tooltip' | owTranslate"
									[owTranslate]="'mercenaries.hero-stats.your-usage'"
								></div>
								<div class="values">
									<div class="value player">
										{{
											ability.playerUsePerMatch != null
												? buildValuePercent(ability.playerUsePerMatch)
												: '--'
										}}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercenariesMetaHeroDetailsComponent extends AbstractSubscriptionComponent implements AfterContentInit {
	heroStats$: Observable<MercenaryInfo>;

	constructor(
		private readonly allCards: CardsFacadeService,
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
	) {
		super(store, cdr);
	}

	ngAfterContentInit(): void {
		this.heroStats$ = combineLatest(
			this.store.gameStats$(),
			this.store.listen$(
				([main, nav]) => main.mercenaries.getGlobalStats(),
				([main, nav]) => main.mercenaries.getReferenceData(),
				([main, nav, prefs]) => nav.navigationMercenaries.selectedHeroId,
				([main, nav, prefs]) => prefs.mercenariesActiveModeFilter,
				([main, nav, prefs]) => prefs.mercenariesActivePveDifficultyFilter,
				([main, nav, prefs]) => prefs.mercenariesActivePvpMmrFilter,
				([main, nav, prefs]) => prefs.mercenariesActiveStarterFilter,
				([main, nav, prefs]) => prefs.mercenariesActiveHeroLevelFilter2,
			),
		).pipe(
			filter(
				([
					gameStats,
					[
						globalStats,
						referenceData,
						selectedHeroId,
						modeFilter,
						difficultyFilter,
						mmrFilter,
						starterFilter,
						levelFilter,
					],
				]) => !!referenceData,
			),
			this.mapData(
				([
					gameStats,
					[
						globalStats,
						referenceData,
						heroCardId,
						modeFilter,
						difficultyFilter,
						mmrFilter,
						starterFilter,
						levelFilter,
					],
				]) => {
					const relevantStats =
						modeFilter === 'pve'
							? gameStats?.filter((stat) => (stat.gameMode as any) === 'mercenaries')
							: gameStats?.filter((stat) => (stat.gameMode as any) === 'mercenaries-pvp');
					const infos = modeFilter === 'pve' ? globalStats?.pve : globalStats?.pvp;
					const heroStats = filterMercenariesHeroStats(
						infos?.heroStats?.filter((stat) => stat.heroCardId === heroCardId),
						modeFilter,
						'all',
						difficultyFilter,
						mmrFilter,
						starterFilter,
						levelFilter,
						this.allCards,
						referenceData,
					);
					const mercenariesMatches = filterMercenariesRuns(
						relevantStats?.filter((stat) => normalizeMercenariesCardId(stat.playerCardId) === heroCardId) ??
							[],
						modeFilter,
						'all',
						difficultyFilter,
						mmrFilter,
						starterFilter,
						levelFilter,
					);
					if (heroStats?.length) {
						const refHeroStat = heroStats[0];
						const globalTotalMatches = sumOnArray(heroStats, (stat) => stat.totalMatches);
						return {
							id: refHeroStat.heroCardId,
							name: this.allCards.getCard(refHeroStat.heroCardId)?.name ?? refHeroStat.heroCardId,
							role: refHeroStat.heroRole,
							globalTotalMatches: globalTotalMatches,
							globalWinrate:
								globalTotalMatches === 0
									? null
									: (100 * sumOnArray(heroStats, (stat) => stat.totalWins)) / globalTotalMatches,
							playerTotalMatches: mercenariesMatches?.length ?? 0,
							playerWinrate: !mercenariesMatches?.length
								? null
								: (100 * mercenariesMatches.filter((stat) => stat.result === 'won').length) /
								  mercenariesMatches.length,
							equipment: this.buildEquipment(heroStats),
							abilities: this.buildAbilities(heroStats, referenceData),
						} as MercenaryInfo;
					} else {
						const merc = referenceData.mercenaries.find(
							(m) => this.allCards.getCardFromDbfId(m.cardDbfId).id === heroCardId,
						);
						if (!merc) {
							console.warn(
								'could not find reference merc',
								referenceData.mercenaries?.length,
								heroCardId,
							);
							return null;
						}
						const mercCard = this.allCards.getCardFromDbfId(merc.cardDbfId);
						return {
							id: mercCard.id,
							name: mercCard.name,
							role: getHeroRole(mercCard.mercenaryRole),
							globalTotalMatches: 0,
							globalWinrate: null,
							globalPopularity: null,
							playerTotalMatches: 0,
							playerWinrate: null,
							equipment: merc.equipments.map((equipment) => {
								const equipmentCard = this.allCards.getCardFromDbfId(equipment.cardDbfId);
								return {
									cardId: equipmentCard.id,
									name: equipmentCard.name,
									globalTotalMatches: 0,
									globalPopularity: null,
									globalWinrate: null,
									playerTotalMatches: 0,
									playerWinrate: null,
								} as MercenaryEquipment;
							}),
							abilities: merc.abilities.map((ability) => {
								const abilityCard = this.allCards.getCardFromDbfId(ability.cardDbfId);
								return {
									cardId: abilityCard.id,
									name: abilityCard.name,
									speed: abilityCard.cost,
									cooldown: abilityCard.mercenaryAbilityCooldown,
									globalTotalMatches: 0,
									globalTotalUses: 0,
									globalUsePerMatch: null,
									playerUsePerMatch: null,
								} as MercenaryAbility;
							}),
						} as MercenaryInfo;
					}
				},
			),
		);
	}

	private buildAbilities(
		heroStats: readonly MercenariesHeroStat[],
		referenceData: MercenariesReferenceData,
	): readonly MercenaryAbility[] {
		// console.debug('building abilities', heroStats, referenceData);
		const abilities = referenceData.mercenaries.find(
			(merc) => this.allCards.getCardFromDbfId(merc.cardDbfId).id === heroStats[0].heroCardId,
		).abilities;
		const abilityIds = abilities
			.map((ability) => ability.cardDbfId)
			.map((abilityDbfId) => this.allCards.getCardFromDbfId(abilityDbfId).id);
		// const abilityIds = getHeroAbilities(heroStats[0].heroCardId);
		return abilityIds.map((abilityId) => {
			// console.debug('handling ability', abilityId);
			const globalTotalMatches = sumOnArray(heroStats, (stat) => this.getSkillTotalMatches(stat, abilityId));
			const globalTotalUses = sumOnArray(heroStats, (stat) => this.getSkillUse(stat, abilityId));
			const result = {
				cardId: abilityId,
				name: this.allCards.getCard(abilityId)?.name ?? abilityId,
				speed: this.allCards.getCard(abilityId).cost,
				cooldown: this.allCards.getCard(abilityId).mercenaryAbilityCooldown,
				globalTotalMatches: globalTotalMatches,
				globalTotalUses: globalTotalUses,
				globalUsePerMatch: globalTotalMatches === 0 ? null : globalTotalUses / globalTotalMatches,
				playerUsePerMatch: null,
			} as MercenaryAbility;
			// console.debug('ability', abilityId, result, globalTotalMatches, globalTotalUses, heroStats);
			return result;
		});
	}

	private getSkillUse(stat: MercenariesHeroStat, abilityId: string): number {
		return stat.skillInfos.find((skill) => skill.cardId === abilityId)?.numberOfTimesUsed ?? 0;
	}

	private getSkillTotalMatches(stat: MercenariesHeroStat, abilityId: string): number {
		return stat.skillInfos.find((skill) => skill.cardId === abilityId)?.numberOfMatches ?? 0;
	}

	private buildEquipment(heroStats: readonly MercenariesHeroStat[]): readonly MercenaryEquipment[] {
		const groupedByEquipment = groupByFunction((stat: MercenariesHeroStat) => stat.equipementCardId)(heroStats);
		const totalMatches = sumOnArray(heroStats, (stat) => stat.totalMatches);
		return Object.keys(groupedByEquipment)
			.map((equipmentId) => {
				const stats = groupedByEquipment[equipmentId];
				const globalTotalMatches = sumOnArray(stats, (stat) => stat.totalMatches);
				// console.debug('equipm', equipmentId, stats, globalTotalMatches);
				return {
					cardId: equipmentId,
					name: this.allCards.getCard(equipmentId)?.name ?? equipmentId,
					globalTotalMatches: globalTotalMatches,
					globalPopularity: totalMatches == null ? null : (100 * globalTotalMatches) / totalMatches,
					globalWinrate:
						globalTotalMatches === 0
							? null
							: (100 * sumOnArray(stats, (stat) => stat.totalWins)) / globalTotalMatches,
					playerTotalMatches: 0,
					playerWinrate: null,
				} as MercenaryEquipment;
			})
			.sort((a, b) => b.globalWinrate - a.globalWinrate);
	}

	buildPortraitArtUrl(heroId: string): string {
		return `https://static.zerotoheroes.com/hearthstone/cardart/256x/${heroId}.jpg`;
	}

	buildPortraitFrameUrl(role: string): string {
		return `https://static.zerotoheroes.com/hearthstone/asset/firestone/mercenaries_hero_frame_golden_${role}.png`;
	}

	buildEquipmentArtUrl(cardId: string): string {
		return `https://static.zerotoheroes.com/hearthstone/cardart/256x/${cardId}.jpg`;
	}

	buildAbilityArtUrl(cardId: string): string {
		return `https://static.zerotoheroes.com/hearthstone/cardart/256x/${cardId}.jpg`;
	}

	trackByFn(index: number, item: MercenaryInfo) {
		return item.id;
	}

	buildValue(value: number, decimals = 2): string {
		if (value === 100) {
			return '100';
		}
		return value == null ? '-' : value.toFixed(decimals);
	}

	buildValuePercent(value: number, decimals = 1): string {
		if (value === 100) {
			return '100%';
		}
		return value == null ? '-' : value.toFixed(decimals) + '%';
	}
}
