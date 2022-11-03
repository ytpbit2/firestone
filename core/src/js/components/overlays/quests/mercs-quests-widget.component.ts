import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef } from '@angular/core';
import { SceneMode } from '@firestone-hs/reference-data';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { filter, startWith } from 'rxjs/operators';
import {
	BattleAbility,
	BattleEquipment,
	BattleMercenary,
	MercenariesBattleTeam,
} from '../../../models/mercenaries/mercenaries-battle-state';
import { CardsFacadeService } from '../../../services/cards-facade.service';
import { LocalizationFacadeService } from '../../../services/localization-facade.service';
import { getHeroRole } from '../../../services/mercenaries/mercenaries-utils';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { buildMercenariesTasksList } from '../../../services/ui-store/mercenaries-ui-helper';
import { AbstractSubscriptionComponent } from '../../abstract-subscription.component';
import { buildTeamForTasks, Task } from '../../mercenaries/overlay/teams/mercenaries-team-root..component';

@Component({
	selector: 'mercs-quests-widget',
	styleUrls: [
		`../../../../css/themes/decktracker-theme.scss`,
		`../../../../css/themes/battlegrounds-theme.scss`,
		'../../../../css/component/overlays/quests/quests-widget-view.component.scss',
		'../../../../css/component/overlays/quests/mercs-quests-widget.component.scss',
	],
	template: `
		<!-- We need to have interactivity with the list for the "create" button, so the 
		mouse detection is at the parent's level -->
		<div class="quests-widget" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()">
			<div
				class="widget-icon"
				*ngIf="showQuests$ | async"
				(click)="onMouseLeave()"
				(mousedown)="onMouseLeave()"
				(mouseup)="onMouseLeave()"
			>
				<img src="https://static.zerotoheroes.com/hearthstone/asset/firestone/images/mercs_quests_icon.png" />
			</div>
			<mercs-tasks-list
				class="task-list"
				[ngClass]="{
					'visible': showTaskList$ | async,
					'right': showRight$ | async,
					'bottom': showBottom$ | async
				}"
				[tasks]="tasks$ | async"
				[taskTeamDeckstring]="taskTeamDeckstring$ | async"
			></mercs-tasks-list>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercsQuestsWidgetComponent extends AbstractSubscriptionComponent implements AfterContentInit {
	tasks$: Observable<readonly Task[]>;
	showQuests$: Observable<boolean>;
	showRight$: Observable<boolean>;
	showBottom$: Observable<boolean>;
	showTaskList$: Observable<boolean>;
	taskTeamDeckstring$: Observable<string>;

	private showWidget$$ = new BehaviorSubject<boolean>(false);
	private showRight$$ = new BehaviorSubject<boolean>(false);
	private showBottom$$ = new BehaviorSubject<boolean>(false);

	constructor(
		protected readonly store: AppUiStoreFacadeService,
		protected readonly cdr: ChangeDetectorRef,
		private readonly el: ElementRef,
		private readonly allCards: CardsFacadeService,
		private readonly i18n: LocalizationFacadeService,
	) {
		super(store, cdr);
	}

	ngAfterContentInit(): void {
		const team$ = this.store
			.listenMercenaries$(([battleState, prefs]) => battleState)
			.pipe(
				filter(([battleState]) => !!battleState),
				this.mapData(([battleState]) =>
					battleState.playerTeam.update({
						...battleState.playerTeam,
						mercenaries:
							battleState.playerTeam.mercenaries?.filter((merc) => !merc.isDead || !merc.creatorCardId) ??
							[],
					}),
				),
				startWith(null),
			);
		const oocTeam$ = combineLatest(
			this.store.listen$(
				([main, nav, prefs]) => main.currentScene,
				([main, nav, prefs]) => main.mercenaries?.getReferenceData(),
				([main, nav, prefs]) => main.mercenaries?.mapInfo,
			),
		).pipe(
			filter(([[currentScene, referenceData, mapInfo]]) => !!referenceData),
			this.mapData(([[currentScene, referenceData, refMapInfo]]) => {
				const mapInfo = currentScene === SceneMode.LETTUCE_MAP ? refMapInfo?.Map : null;
				return MercenariesBattleTeam.create({
					mercenaries:
						mapInfo?.PlayerTeam?.map((playerTeamInfo) => {
							const refMerc = referenceData.mercenaries.find((merc) => merc.id === playerTeamInfo.Id);
							if (!refMerc) {
								console.warn('could not find reference merc', playerTeamInfo.Id);
								return null;
							}
							const mercCard = this.allCards.getCardFromDbfId(refMerc.cardDbfId);
							return BattleMercenary.create({
								mercenaryId: refMerc?.id,
								cardId: mercCard.id,
								role: getHeroRole(mercCard.mercenaryRole),
								level: playerTeamInfo.Level,
								isDead: (mapInfo.DeadMercIds ?? []).includes(playerTeamInfo.Id),
								abilities: [
									...playerTeamInfo.Abilities.map((ability) => {
										return BattleAbility.create({
											cardId: ability.CardId,
										});
									}),
									...(playerTeamInfo.TreasureCardDbfIds ?? []).map((treasureDbfId) => {
										return BattleAbility.create({
											cardId: this.allCards.getCardFromDbfId(treasureDbfId).id,
											isTreasure: true,
										});
									}),
								],
								equipment: (playerTeamInfo.Equipments ?? [])
									.filter((equip) => equip.Equipped)
									.map((equip) => {
										const refEquipment = refMerc.equipments?.find(
											(e) => e.equipmentId === equip.Id,
										);
										return BattleEquipment.create({
											cardId: this.allCards.getCardFromDbfId(refEquipment?.cardDbfId)?.id,
											level: equip.Tier,
										});
									})
									.pop(),
							});
						}) ?? [],
				});
			}),
			startWith(null),
		);
		this.tasks$ = combineLatest(
			this.store.listen$(
				([main, nav, prefs]) => main.mercenaries.getReferenceData(),
				([main, nav, prefs]) => main.mercenaries.collectionInfo?.Visitors,
			),
			team$,
			oocTeam$,
		).pipe(
			filter(([[referenceData, visitors], team, oocTeam]) => !!referenceData && !!visitors?.length),
			this.mapData(([[referenceData, visitors], team, oocTeam]) => {
				const allActiveMercs = [...(team?.mercenaries ?? []), ...(oocTeam?.mercenaries ?? [])];
				return buildMercenariesTasksList(
					referenceData,
					visitors,
					this.allCards,
					this.i18n,
					allActiveMercs.map((m) => m.mercenaryId),
				);
			}),
		);
		this.taskTeamDeckstring$ = combineLatest(
			this.store.listen$(
				([main, nav]) => main.mercenaries.getReferenceData(),
				([main, nav]) => main.mercenaries.collectionInfo,
			),
			this.store.listenPrefs$((prefs) => prefs.mercenariesBackupTeam),
			this.tasks$,
		).pipe(
			this.mapData(([[refData, collectionInfo], [mercBackupIds], tasks]) =>
				buildTeamForTasks(tasks, refData, collectionInfo, mercBackupIds, this.allCards, this.i18n),
			),
		);
		this.showQuests$ = combineLatest(
			this.store.listenPrefs$(
				(prefs) => prefs.mercsShowQuestsWidget,
				(prefs) => prefs.showQuestsWidgetWhenEmpty,
			),
			this.tasks$,
		).pipe(
			this.mapData(([[showQuests, showWhenEmpty], quests]) => {
				return showQuests && (!!quests?.length || showWhenEmpty);
			}),
		);
		this.showTaskList$ = this.showWidget$$.asObservable().pipe(this.mapData((info) => info));
		this.showRight$ = this.showRight$$.asObservable().pipe(this.mapData((info) => info));
		this.showBottom$ = this.showBottom$$.asObservable().pipe(this.mapData((info) => info));
	}

	onMouseEnter() {
		this.showWidget$$.next(true);
		const rect = this.el.nativeElement.getBoundingClientRect();
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		this.showRight$$.next(rect.x < windowWidth / 2);
		this.showBottom$$.next(rect.y < windowHeight / 2);
	}

	onMouseLeave() {
		this.showWidget$$.next(false);
	}
}
