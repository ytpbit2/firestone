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
import { BattlegroundsStoreEvent } from '../../../services/battlegrounds/store/events/_battlegrounds-store-event';
import { OverwolfService } from '../../../services/overwolf.service';
import { groupByFunction } from '../../../services/utils';
import { BgsMinionsGroup } from './bgs-minions-group';

@Component({
	selector: 'bgs-minions-info',
	styleUrls: [
		'../../../../css/global/components-global.scss',
		`../../../../css/global/cdk-overlay.scss`,
		`../../../../css/component/battlegrounds/minions-tiers/bgs-minions-info.component.scss`,
	],
	template: `
		<ul class="bgs-minions-info">
			<li *ngFor="let filter of _filter">
				<span class="keyword">{{ filter.keyword }}</span>
				<span class="info">{{ filter.minions.length }}</span>
			</li>
		</ul>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlegroundsMinionsInfoComponent implements AfterViewInit {
	@Input() set cards(value: readonly ReferenceCard[]) {
		this._cards = value;
		this.updateInfos();
	}

	_cards: readonly ReferenceCard[];
	_highlightedMinions: readonly string[];
	_highlightedTribes: readonly Race[];
	_showTribesHighlight: boolean;
	_showGoldenCards: boolean;

	_filter: MinionsFilter[];
	private battlegroundsUpdater: EventEmitter<BattlegroundsStoreEvent>;

	constructor(private readonly cdr: ChangeDetectorRef, private readonly ow: OverwolfService) {}
	async ngAfterViewInit() {
		this.battlegroundsUpdater = (await this.ow.getMainWindow())?.battlegroundsUpdater;
	}

	private updateInfos() {
		if (!this._cards) {
			return;
		}

		// this.groups = [];
		// if (!(this.cdr as ViewRef)?.destroyed) {
		// 	this.cdr.detectChanges();
		// }

		this._filter = this.buildFilter();
		console.log('debug minion info', this._filter);
		if (!(this.cdr as ViewRef)?.destroyed) {
			this.cdr.detectChanges();
		}
		// });
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
			{ keyword: 'BATTLECRY', minions: this._cards.filter((c) => hasMechanism(c, 'BATTLECRY')) },
			{ keyword: 'DEATHRATTLE', minions: this._cards.filter((c) => hasMechanism(c, 'DEATHRATTLE')) },
			{ keyword: 'REBORN', minions: this._cards.filter((c) => hasMechanism(c, 'REBORN')) },
			{ keyword: 'SUMMON', minions: this._cards.filter((c) => hasMechanism(c, 'DEATHRATTLE')) },
		];
	}
}

class MinionsFilter {
	readonly keyword: string;
	readonly minions: readonly ReferenceCard[];
}
