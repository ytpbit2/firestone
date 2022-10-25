import { MainWindowState } from '@models/mainwindow/main-window-state';
import { NavigationState } from '@models/mainwindow/navigation/navigation-state';
import { Processor } from '@services/mainwindow/store/processors/processor';
import { PreferencesService } from '../../../../preferences.service';
import { ConstructedEjectDeckVersionEvent } from '../../events/decktracker/constructed-eject-deck-version-event';

export class ConstructedEjectDeckVersionProcessor implements Processor {
	constructor(private readonly prefs: PreferencesService) {}

	public async process(
		event: ConstructedEjectDeckVersionEvent,
		currentState: MainWindowState,
		history,
		navigationState: NavigationState,
	): Promise<[MainWindowState, NavigationState]> {
		console.debug('[deck] ejecting version', event, currentState);
		const prefs = await this.prefs.getPreferences();
		const versionLinks = prefs.constructedDeckVersions;
		console.debug('[deck] existing versionLinks', versionLinks);
		const newVersionLinks = versionLinks.map((link) => ({
			...link,
			versions: link.versions.filter((version) => version.deckstring !== event.deckstringToEject),
		}));
		console.debug('[deck] newVersionLinks', newVersionLinks);

		await this.prefs.savePreferences({ ...prefs, constructedDeckVersions: newVersionLinks });
		return [null, null];
	}
}
