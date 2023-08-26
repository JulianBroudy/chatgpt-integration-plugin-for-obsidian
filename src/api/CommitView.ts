import {ItemView, WorkspaceLeaf} from "obsidian";
import {StagedChange, StagingArea} from "./StaginArea";
import LOGGER from "../utils/Logger";

export const COMMIT_VIEW_TYPE = "commit-view";

export class CommitView extends ItemView {
	private stagingArea: StagingArea;
	private changeElements: Map<StagedChange, HTMLElement>;
	private documentIdToChange: Map<string, StagedChange>;
	private stagedContainer;
	private unstagedContainer;

	constructor(leaf: WorkspaceLeaf, stagingArea: StagingArea) {
		super(leaf);
		this.stagingArea = stagingArea;
		this.changeElements = new Map();
		this.documentIdToChange = new Map();
		this.stagedContainer = this.contentEl.createDiv('staged-changes resizable');
		this.stagedContainer.createEl('h3', {text: 'Staged Changes'});
		this.unstagedContainer = this.contentEl.createDiv('unstaged-changes resizable');
		this.unstagedContainer.createEl('h3', {text: 'Unstaged Changes'});
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
		// Clear the existing content
		// this.contentEl.empty();
		await this.stagingArea.computeChangedFiles();

		// Create a container for the staged changes


		this.stagingArea.getStagedChanges().forEach(change => {
			this.createChangeItem(this.stagedContainer, change, true);
		});

		// Create a container for the unstaged changes
		const unstagedChanges = this.stagingArea.getUnstagedChanges();
		LOGGER.info("Unstaged changes: ", unstagedChanges)
		unstagedChanges.forEach(change => {
			LOGGER.info("Creating unstaged item");
			this.createChangeItem(this.unstagedContainer, change, false);
		});

		// Create a commit button
		const commitButton = this.contentEl.createEl('button', {text: 'Commit', cls: 'mod-cta'});
		commitButton.addEventListener('click', () => {
			this.stagingArea.commitChanges();
			// Refresh the view or perform other actions after committing
		});

		// To allow dropping
		['dragover', 'drop'].forEach(eventName => {
			[this.stagedContainer, this.unstagedContainer].forEach(container => {
				container.addEventListener(eventName, (event) => {
					event.preventDefault();
					event.stopPropagation();
				});

				container.addEventListener('drop', (event) => {
					const id = event.dataTransfer!.getData('text/plain');

					const change = this.documentIdToChange.get(id);
					const item = this.changeElements.get(change!);
					if (item && item.parentElement !== container) {
						container.appendChild(item);
						// Update stage/unstage logic here
						if (container === this.stagedContainer) {
							this.stagingArea.stageChange(change!);
						} else {
							this.stagingArea.unstageChange(change!);
						}
					}
				});
			});
		});

	}

	private createChangeItem(container: HTMLElement, change: StagedChange, isStaged: boolean): HTMLElement {
		const item = container.createDiv('change-item');
		item.createEl('span', {text: `${change.document.documentId}`});
		item.addClass(change.type);
		// Make it draggable
		item.draggable = true;

		item.addEventListener('dragstart', (event) => {
			event.dataTransfer!.setData('text/plain', change.document.documentId!);
		});

		// Double click to move
		item.addEventListener('dblclick', () => {
			if (item.parentElement === this.stagedContainer) {
				this.stagingArea.unstageChange(change);
				this.unstagedContainer.appendChild(item);
			} else {
				this.stagingArea.stageChange(change);
				this.stagedContainer.appendChild(item);
			}
		});

		// Update the map
		this.changeElements.set(change, item);
		this.documentIdToChange.set(change.document.documentId!, change);

		return item;
	}


}
