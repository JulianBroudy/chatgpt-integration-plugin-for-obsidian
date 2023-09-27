import {DataStore} from "./datastore";
import FileStateTree from "../models/FileStateTree";
import {DocumentMetadata, Source} from "../models/models";
import {TFile} from "obsidian";
import {FileState} from "../models/TreeNode";
import LOGGER from "../utils/Logger";

export default class FileStateTreeBuilder {
	private datastore: DataStore;

	constructor(datastore: DataStore) {
		this.datastore = datastore;
	}

	async build() {
		const fileStateTree = new FileStateTree(app.vault.getRoot());
		const obsidianFilesMap = new Map<string, TFile>(app.vault.getAllLoadedFiles()
			.filter(f => f instanceof TFile)
			.map(f => [(f as TFile).basename, f as TFile]));
		LOGGER.silly(obsidianFilesMap)
		app.vault.getAllLoadedFiles().filter(f => f instanceof TFile).forEach(f => LOGGER.info((f as TFile).basename));
		const syncedFiles = await this.fetchSyncedFiles();
		LOGGER.silly("Synced Files" + syncedFiles)
		this.populateFileStateTree(fileStateTree, obsidianFilesMap, syncedFiles);
		return fileStateTree;
	}

	private populateFileStateTree(fileStateTree: FileStateTree, obsidianFilesMap: Map<string, TFile>, syncedFiles: DocumentMetadata[]) {
		syncedFiles.forEach(syncedFile => {
			const createdAtDate = new Date(<string>syncedFile.createdAt);
			const loadedFile = obsidianFilesMap.get(syncedFile.sourceId);

			if (loadedFile) {
				const mtimeDate = new Date(loadedFile.stat.mtime);
				if (createdAtDate < mtimeDate) {
					LOGGER.silly('createdAtDate < mtimeDate:' + createdAtDate + ' < ' + mtimeDate);
					this.addNode(fileStateTree, loadedFile, FileState.MODIFIED, syncedFile);
				}
				obsidianFilesMap.delete(syncedFile.sourceId); // Remove from map to identify new files later
			} else if (syncedFile.source == Source.FILE) {
				// TODO: find a way to handle deleted files
				LOGGER.warn("Currently not supporting deleted files!");
				// this.addNode(fileStateTree, new TFile(), FileState.DELETED, syncedFile);
				// this.addChange({document: syncedFile, type: 'deleted'}); // File is in database but not in Obsidian
			}
		});

		// Process remaining Obsidian files that are not in the database (new files)
		obsidianFilesMap.forEach(loadedFile => {
			this.addNode(fileStateTree, loadedFile, FileState.NEW, new DocumentMetadata());
		});
	}

	private async fetchSyncedFiles() {
		const newlyFetchedFiles = await this.datastore.getSyncedDocuments();
		LOGGER.info('Fetched synced files: \n' + newlyFetchedFiles);
		return newlyFetchedFiles;
	}

	private addNode(fileStateTree: FileStateTree, loadedFile: TFile, fileState: FileState, syncedFile: DocumentMetadata) {
		// fileStateTree.logMapState();
		fileStateTree.addNode(loadedFile, fileState, syncedFile);
		// fileStateTree.logMapState();
	}
}
