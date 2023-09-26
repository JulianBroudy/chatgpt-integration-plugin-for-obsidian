export default class FileUIState {
	checkedFiles: Set<string>;
	checkedChildrenCountMap: Map<string, number>;
	indeterminateFolders: Set<string>;
	collapsedFolders: Set<string>;

	constructor() {
		this.checkedFiles = new Set();
		this.checkedChildrenCountMap = new Map();
		this.indeterminateFolders = new Set();
		this.collapsedFolders = new Set();
	}

	checkFile(filePath: string) {
		this.checkedFiles.add(filePath);
	}

	uncheckFile(filePath: string) {
		this.checkedFiles.delete(filePath);
	}

	clearCheckedFiles(){
		this.checkedFiles.clear();
	}

	expandFolder(folderPath: string) {
		this.collapsedFolders.delete(folderPath);
	}

	collapseFolder(folderPath: string) {
		this.collapsedFolders.add(folderPath);
	}

	toggleFolder(folderPath: string) {
		if (this.isFolderExpanded(folderPath)) {
			this.collapseFolder(folderPath);
		} else {
			this.expandFolder(folderPath);
		}
	}

	isFolderExpanded(folderPath: string): boolean {
		return !this.collapsedFolders.has(folderPath);
	}

}
