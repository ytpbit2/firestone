import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	ViewRef,
} from '@angular/core';
import { Race, ReferenceCard } from '@firestone-hs/reference-data';
import { getEffectiveTribe, tribeValueForSort } from '../../../services/battlegrounds/bgs-utils';
import { BgsResetHighlightsEvent } from '../../../services/battlegrounds/store/events/bgs-reset-highlights-event';
import { BattlegroundsStoreEvent } from '../../../services/battlegrounds/store/events/_battlegrounds-store-event';
import { OverwolfService } from '../../../services/overwolf.service';
import { groupByFunction } from '../../../services/utils';
import { BgsMinionsGroup } from './bgs-minions-group';

@Component({
	selector: 'bgs-minions-list',
	styleUrls: [
		'../../../../css/global/components-global.scss',
		`../../../../css/global/cdk-overlay.scss`,
		'../../../../css/component/battlegrounds/minions-tiers/bgs-minions-list.component.scss',
	],
	template: `
		<div class="bgs-minions-list">
			<bgs-minions-group
				class="minion-group"
				*ngFor="let group of groups"
				[group]="group"
				[showTribesHighlight]="_showTribesHighlight"
				[showGoldenCards]="_showGoldenCards"
			></bgs-minions-group>
			<bgs-minions-info [cards]="_cards"> </bgs-minions-info>
			<div class="reset-all-button" (click)="resetHighlights()" *ngIf="_showTribesHighlight">
				<div class="background-second-part"></div>
				<div class="background-main-part"></div>
				<div class="content">
					<div class="icon" inlineSVG="assets/svg/restore.svg"></div>
					{{ 'battlegrounds.in-game.minions-list.reset-button' | owTranslate }}
				</div>
			</div>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlegroundsMinionsListComponent implements AfterViewInit {
	@Input() set cards(value: readonly ReferenceCard[]) {
		this._cards = value;
		this.updateInfos();
	}

	@Input() set highlightedMinions(value: readonly string[]) {
		this._highlightedMinions = value;
		this.updateInfos();
	}

	@Input() set highlightedTribes(value: readonly Race[]) {
		this._highlightedTribes = value;
		this.updateInfos();
	}

	@Input() set showTribesHighlight(value: boolean) {
		this._showTribesHighlight = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	@Input() set showGoldenCards(value: boolean) {
		this._showGoldenCards = value;
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
	}

	_cards: readonly ReferenceCard[];
	_highlightedMinions: readonly string[];
	_highlightedTribes: readonly Race[];
	_showTribesHighlight: boolean;
	_showGoldenCards: boolean;
	groups: readonly BgsMinionsGroup[];
	filters: MinionsFilter[];

	private battlegroundsUpdater: EventEmitter<BattlegroundsStoreEvent>;

	constructor(private readonly cdr: ChangeDetectorRef, private readonly ow: OverwolfService) {}

	async ngAfterViewInit() {
		this.battlegroundsUpdater = (await this.ow.getMainWindow())?.battlegroundsUpdater;
	}

	resetHighlights() {
		this.battlegroundsUpdater.next(new BgsResetHighlightsEvent());
	}

	private updateInfos() {
		if (!this._cards) {
			return;
		}

		// this.groups = [];
		// if (!(this.cdr as ViewRef)?.destroyed) {
		// 	this.cdr.detectChanges();
		// }

		// setTimeout(() => {
		const groupedByTribe = groupByFunction((card: ReferenceCard) => getEffectiveTribe(card, false))(this._cards);
		this.groups = Object.keys(groupedByTribe)
			.sort((a: string, b: string) => tribeValueForSort(a) - tribeValueForSort(b)) // Keep consistent ordering
			.map((tribeString) => ({
				tribe: Race[tribeString],
				minions: groupedByTribe[tribeString],
				highlightedMinions: this._highlightedMinions || [],
				highlightedTribes: this._highlightedTribes || [],
			}));

		console.log('debug minion info', this.groups);
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
		this.buildFilter();
	}

	private buildFilter(): MinionsFilter[] {
		const includes = (targetElement: string) => (arrElement: string) => arrElement.includes(targetElement);
		const hasMechanism = (card: ReferenceCard, predicate: string) => {
			if (!card.mechanics) {
				return false;
			}
			return card.mechanics.some(includes(predicate));
		};
		return [
			{ keyword: 'ALL', minions: this._cards },
			{ keyword: 'BATTLECRY', minions: this._cards.filter((c) => hasMechanism(c, 'BATTLECRY')) },
			{ keyword: 'DEATH RATTLE', minions: this._cards.filter((c) => hasMechanism(c, 'DEATHRATTLE')) },
			{ keyword: 'REBORN', minions: this._cards.filter((c) => hasMechanism(c, 'REBORN')) },
			{ keyword: 'SUMMON', minions: this._cards.filter((c) => hasMechanism(c, 'DEATHRATTLE')) },
		];
	}
}

interface MinionsFilter {
	readonly keyword: string;
	readonly minions: readonly ReferenceCard[];
}
