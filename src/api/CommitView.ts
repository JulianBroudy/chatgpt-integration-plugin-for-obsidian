import {ItemView, TFile, TFolder, WorkspaceLeaf} from "obsidian";
import {StagedChange, StagingArea} from "./StaginArea";

export const COMMIT_VIEW_TYPE = "commit-view";

export class CommitView extends ItemView {
	private stagingArea: StagingArea;
	private rootContainer: HTMLElement;
	private readonly indentation = 21;

	constructor(leaf: WorkspaceLeaf, stagingArea: StagingArea) {
		super(leaf);
		this.stagingArea = stagingArea;
		this.rootContainer = this.contentEl.createDiv('changes-root');
		this.rootContainer.createEl('h3', {text: 'Changes'});
		this.load();
	}

	async onload() {
		await this.initializeView();
	}

	getViewType() {
		return COMMIT_VIEW_TYPE;
	}

	getDisplayText() {
		return "Commit view";
	}

	private async initializeView() {
		await this.stagingArea.computeChangedFiles();
		const allChanges = [...this.stagingArea.getStagedChanges(), ...this.stagingArea.getUnstagedChanges()];
		const changeMap = new Map(allChanges
			.filter(change => change.document.sourceId !== undefined)
			.map(change => [change.document.sourceId!, change]));

		const root = this.app.vault.getRoot();
		this.renderFolder(root, this.rootContainer, 0, changeMap);
	}

	private renderFolder(folder: TFolder, parentElement: HTMLElement, level: number, changeMap: Map<string, StagedChange>): number {
		const folderDiv = parentElement.createDiv({cls: 'folder-item'});
		folderDiv.style.marginLeft = `${level * this.indentation}px`; // Indentation

		const folderLine = folderDiv.createDiv({cls: 'folder-line'});
		folderLine.addEventListener('dblclick', () => {
			this.toggleFolder(arrowContainer, childrenDiv, rightArrow, downArrow);
		});

		const arrowContainer: HTMLElement = folderLine.createEl('div', {cls: 'arrow-container'});
		const rightArrow: HTMLElement = arrowContainer.createEl('div');
		rightArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>';  // Lucide "chevron-right"
		const downArrow: HTMLElement = arrowContainer.createEl('div');
		downArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>';  // Lucide "chevron-down"
		downArrow.style.display = 'none'; // Initially hidden

		folderLine.createEl('div', {cls: 'line-section'}).createEl('input', {type: 'checkbox', cls: 'no-margin'});  // Checkbox

		const folderIcon: HTMLElement = folderLine.createEl('div');
		folderIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#43454A" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>';  // Lucide "folder-git"

		folderLine.createEl('span', {text: folder.isRoot() ? app.vault.getName() : folder.name, cls:'item-text'});

		const childrenDiv = parentElement.createDiv({cls: 'folder-children'});
		childrenDiv.style.display = 'none';  // Initially collapsed

		// Toggle folder on click
		arrowContainer.addEventListener('click', () => {
			this.toggleFolder(arrowContainer, childrenDiv, rightArrow, downArrow);
		});


		let visibleFileCount = 0;  // Initialize count of visible files in this folder and its subfolders

		// Loop through child folders first
		for (const child of folder.children.filter(c => c instanceof TFolder)) {
			visibleFileCount += this.renderFolder(child as TFolder, childrenDiv, level + 1, changeMap);
		}

		// Loop through child files next
		for (const child of folder.children.filter(c => c instanceof TFile)) {
			if (changeMap.has((child as TFile).path)) {
				this.renderFile(child as TFile, childrenDiv, level + 2, changeMap.get((child as TFile).path));
				visibleFileCount++;  // Increase the count of visible files
			}
		}

		// Hide folder if it has no visible children
		if (visibleFileCount === 0) {
			folderDiv.style.display = 'none';
		} else {
			// Add "x files" next to the folder name
			folderLine.createEl('span', {text: `${visibleFileCount} files`, cls: 'folder-file-count'});
		}

		return visibleFileCount;  // Return the count of visible files
	}

	private renderFile(file: TFile, parentElement: HTMLElement, level: number, change: StagedChange | undefined) {
		const fileDiv = parentElement.createDiv({cls: 'file-item'});
		fileDiv.style.marginLeft = `${level * this.indentation}px`; // Indentation
		fileDiv.createEl('div', {cls: 'line-section'}).createEl('input', {type: 'checkbox', cls: 'no-margin'});
		fileDiv.createEl('span', {text: file.name, cls: `item-text ${change?.type}`});

		if (change && this.stagingArea.getStagedChanges().includes(change)) {
			fileDiv.querySelector('input')!.checked = true;
		}
	}

	private toggleFolder(arrowContainer: HTMLElement, childrenDiv: HTMLElement, rightArrow: HTMLElement, downArrow: HTMLElement, collapseOnly: boolean = false) {
		if (childrenDiv.style.display === 'none' && !collapseOnly) {
			childrenDiv.style.display = 'block';
			rightArrow.style.display = 'none';
			downArrow.style.display = 'block';
		} else {
			childrenDiv.style.display = 'none';
			rightArrow.style.display = 'block';
			downArrow.style.display = 'none';

			// Collapse all sub-folders
			childrenDiv.querySelectorAll('.folder-children').forEach((childDiv: HTMLElement) => {
				const childArrowContainer = childDiv.previousElementSibling!.querySelector('.arrow-container') as HTMLElement;
				const childRightArrow = childArrowContainer.querySelector('.lucide-chevron-right')!.parentElement as HTMLElement;
				const childDownArrow = childArrowContainer.querySelector('.lucide-chevron-down')!.parentElement as HTMLElement;
				this.toggleFolder(childArrowContainer, childDiv as HTMLElement, childRightArrow, childDownArrow, true);
			});
		}
	}
}
