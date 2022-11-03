import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { GameStat } from '@models/mainwindow/stats/game-stat';
import { addDaysToDate, daysBetweenDates, formatDate, groupByFunction } from '@services/utils';
import { ChartDataSets } from 'chart.js';
import { Label } from 'ng2-charts';
import { combineLatest, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { StatsXpGraphSeasonFilterType } from '../../../models/mainwindow/stats/stats-xp-graph-season-filter.type';
import {
	computeXpFromLevel,
	getSeason,
	xpSeason1,
	xpSeason2,
	xpSeason3,
	xpSeason4,
	xpSeason5,
	xpSeason6,
} from '../../../services/stats/xp/xp-tables/xp-computation';
import { AppUiStoreFacadeService } from '../../../services/ui-store/app-ui-store-facade.service';
import { AbstractSubscriptionComponent } from '../../abstract-subscription.component';

@Component({
	selector: 'stats-xp-graph',
	styleUrls: [
		`../../../../css/global/components-global.scss`,
		`../../../../css/component/stats/desktop/stats-xp-graph.component.scss`,
	],
	template: `
		<div class="stats-xp-graph" *ngIf="value$ | async as value">
			<graph-with-single-value
				[data]="value.data"
				[labels]="value.labels"
				emptyStateMessage="No data available for this season"
			></graph-with-single-value>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsXpGraphComponent extends AbstractSubscriptionComponent implements AfterContentInit {
	value$: Observable<Value>;

	constructor(protected readonly store: AppUiStoreFacadeService, protected readonly cdr: ChangeDetectorRef) {
		super(store, cdr);
	}

	ngAfterContentInit(): void {
		this.value$ = combineLatest(
			this.store.gameStats$(),
			this.store.listen$(([main, nav]) => main.stats.filters.xpGraphSeasonFilter),
		).pipe(
			filter(([stats, seasonFilter]) => !!seasonFilter),
			this.mapData(([stats, [seasonFilter]]) =>
				this.buildValue(
					stats.filter((stat) => stat.levelAfterMatch),
					seasonFilter,
				),
			),
		);
	}

	private buildValue(stats: readonly GameStat[], seasonFilter: StatsXpGraphSeasonFilterType): Value {
		const data = [...stats].reverse();
		const dataWithTime = data.filter((stat) => this.isValidDate(stat, seasonFilter));
		if (!dataWithTime?.length) {
			return { data: [], labels: [] };
		}

		const values: number[] = [];
		const groupedByDay: { [date: string]: readonly GameStat[] } = groupByFunction((match: GameStat) =>
			formatDate(new Date(match.creationTimestamp)),
		)(dataWithTime);
		console.debug('data', dataWithTime);
		const daysSinceStart = daysBetweenDates(
			formatDate(new Date(dataWithTime[0].creationTimestamp)),
			formatDate(new Date(dataWithTime[dataWithTime.length - 1].creationTimestamp)),
		);
		const labels = Array.from(Array(daysSinceStart), (_, i) =>
			addDaysToDate(dataWithTime[0].creationTimestamp, i),
		).map((date) => formatDate(date));
		for (const date of labels) {
			const valuesForDay = groupedByDay[date] ?? [];
			const firstGameOfDay = valuesForDay[0];
			const xpForDay = firstGameOfDay
				? computeXpFromLevel(firstGameOfDay.levelAfterMatch, firstGameOfDay.creationTimestamp)
				: 0;
			const previousDayXp = !!values?.length ? values[values.length - 1] : 0;
			values.push(previousDayXp + xpForDay);
		}
		return {
			data: [
				{
					data: values,
					label: 'Rating',
				},
			],
			labels: labels,
		} as Value;
	}

	private isValidDate(stat: GameStat, seasonFilter: StatsXpGraphSeasonFilterType): boolean {
		switch (seasonFilter) {
			case 'season-1':
				return getSeason(stat.creationTimestamp) === xpSeason1;
			case 'season-2':
				return getSeason(stat.creationTimestamp) === xpSeason2;
			case 'season-3':
				return getSeason(stat.creationTimestamp) === xpSeason3;
			case 'season-4':
				return getSeason(stat.creationTimestamp) === xpSeason4;
			case 'season-5':
				return getSeason(stat.creationTimestamp) === xpSeason5;
			case 'season-6':
				return getSeason(stat.creationTimestamp) === xpSeason6;
			case 'all-seasons':
			default:
				return true;
		}
	}
}

interface Value {
	readonly data: ChartDataSets[];
	readonly labels: Label;
	readonly labelFormattingFn?: (label: string, index: number, labels: string[]) => string;
	readonly reverse?: boolean;
}
