import {DocumentChunkMetadata, Source} from "../models/models";
import {DataStore} from "../services/datastore";
import LOGGER from "../utils/Logger";
import {TFile} from "obsidian";

export interface StagedChange {
	document: DocumentChunkMetadata;
	type: 'added' | 'modified' | 'deleted';
}

export class StagingArea {
	private syncedFiles: DocumentChunkMetadata[] = [];
	private datastore: DataStore;
	private stagedChanges: StagedChange[] = [];
	private unstagedChanges: StagedChange[] = [];

	constructor(dataStoreService: DataStore) {
		this.datastore = dataStoreService;
	}

	// Method to add a change to the unstaged area
	public addChange(change: StagedChange) {
		this.unstagedChanges.push(change);
		// You may want to refresh the view or trigger other updates here
	}

	// Method to get all staged changes
	public getStagedChanges(): StagedChange[] {
		return this.stagedChanges;
	}

	// Method to get all unstaged changes
	public getUnstagedChanges(): StagedChange[] {
		return this.unstagedChanges;
	}

	// Method to move a change from unstaged to staged
	public stageChange(change: StagedChange) {
		const index = this.unstagedChanges.indexOf(change);
		if (index !== -1) {
			this.unstagedChanges.splice(index, 1);
			this.stagedChanges.push(change);
			// You may want to refresh the view or trigger other updates here
		}
	}

	// Method to move a change from staged to unstaged
	public unstageChange(change: StagedChange) {
		const index = this.stagedChanges.indexOf(change);
		if (index !== -1) {
			this.stagedChanges.splice(index, 1);
			this.unstagedChanges.push(change);
			// You may want to refresh the view or trigger other updates here
		}
	}

	// Method to commit all staged changes
	public commitChanges() {
		// Implement the logic to commit the changes, e.g., saving to the database or filesystem
		// You may also want to clear the stagedChanges array and refresh the view
		this.stagedChanges = [];
	}

	public async computeChangedFiles() {
		this.syncedFiles = await this.fetchSyncedFiles();
		const obsidianFilesMap = new Map<string, TFile>(app.vault.getAllLoadedFiles()
			.filter(f => f instanceof TFile)
			.map(f => [(f as TFile).basename, f as TFile]));
		app.vault.getAllLoadedFiles().filter(f => f instanceof TFile).forEach(f => LOGGER.info((f as TFile).basename));
		LOGGER.info("Computing changed files...");
		// LOGGER.info("Obsidian Files = " + Array.from(obsidianFilesMap.keys()).join(', '));
		// LOGGER.info("Currently: ", this.unstagedChanges);

		// Process synced files to find modified and deleted files
		this.syncedFiles.forEach(syncedFile => {
			const createdAtDate = new Date(<string>syncedFile.createdAt);
			const loadedFile = obsidianFilesMap.get(syncedFile.documentId!);

			if (loadedFile) {
				const mtimeDate = new Date(loadedFile.stat.mtime);
				const ctimeDate = new Date(loadedFile.stat.ctime);
				LOGGER.info('DB File:' + syncedFile.documentId + '\ncreatedAtDate:' + createdAtDate);
				LOGGER.info('FS File:' + loadedFile.basename + '\nmtimeDate:' + mtimeDate + '\nctimeDate:' + ctimeDate);
				if (createdAtDate < mtimeDate) {
					LOGGER.info('createdAtDate < mtimeDate:' + createdAtDate + ' < ' + mtimeDate);
					this.addChange({document: syncedFile, type: 'modified'});
				}
				obsidianFilesMap.delete(syncedFile.documentId!); // Remove from map to identify new files later
			} else if (syncedFile.source == Source.FILE) {
				LOGGER.warn("DELETED: " + loadedFile)
				LOGGER.warn("DELETED: " + syncedFile.documentId)
				this.addChange({document: syncedFile, type: 'deleted'}); // File is in database but not in Obsidian
			}
		});

		// Process remaining Obsidian files that are not in the database (new files)
		obsidianFilesMap.forEach(loadedFile => {
			this.addChange({
				document: new DocumentChunkMetadata({
					createdAt: loadedFile.stat.mtime.toString(),
					source: Source.FILE,
					sourceId: loadedFile.basename,
					author: app.vault.getName()
				}, loadedFile.basename), type: 'added'
			});
		});
		LOGGER.info("After: " + this.unstagedChanges);
	}

	private async fetchSyncedFiles() {
		const newlyFetchedFiles = await this.datastore.getSyncedDocuments();
		LOGGER.info('Fetched synced files: \n' + newlyFetchedFiles);
		return newlyFetchedFiles;
	}

}
