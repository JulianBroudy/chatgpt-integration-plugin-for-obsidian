import {ItemView, TFile, WorkspaceLeaf} from "obsidian";
import FileStateTree from "../models/FileStateTree";
import FileStateTreeBuilder from "../services/FileStateTreeBuilder";
import FileUIState from "../models/FileUIState";
import TreeNode from "../models/TreeNode";
import {Document, DocumentMetadata, Source} from "../models/models";
import ServiceLocator from "../utils/ServiceLocator";
import {DataStore} from "../services/datastore";
import LOGGER from "../utils/Logger";

export const VIEW_TYPE_SYNC_VIEW = "sync-view";

export class SyncView extends ItemView {
	private fileStateTree: FileStateTree;
	private fileUIState: FileUIState;
	private fileStateTreeBuilder: FileStateTreeBuilder;
	private isBuilt: boolean;
	private rootContainer: HTMLElement;
	private folderIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#43454A" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>';
	private fileIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#43454A" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>';
	private downArrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>';
	private rightArrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>';
	private refreshIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';
	private expandAllIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-up-down"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>';
	private collapseAllIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-down-up"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>';

	private readonly indentation = 22;

	constructor(leaf: WorkspaceLeaf, fileStateTreeBuilder: FileStateTreeBuilder) {
		super(leaf);
		this.fileStateTreeBuilder = fileStateTreeBuilder;
		this.isBuilt = false;
		this.rootContainer = this.contentEl.createDiv();
		this.fileUIState = new FileUIState();  // Initialize UI State
		this.addCommitButton();
		this.load();
	}

	async onload() {
		await this.initialize();
		this.render();  // Initial rendering
	}

	getViewType() {
		return VIEW_TYPE_SYNC_VIEW;
	}

	getDisplayText() {
		return "Sync view";
	}

	private addCommitButton() {
		const commitButton = this.contentEl.createEl('button', {text: 'Commit/Sync'});
		commitButton.addEventListener('click', async () => {
			const documentsForUpsert: Document[] = [];
			const vaultName = this.app.vault.getName();
			for (const checkedFilePath of this.fileUIState.checkedFiles) {
				const node = this.fileStateTree.getNode(checkedFilePath);
				if (node?.abstractFile instanceof TFile) {
					const file = node.abstractFile;
					const content = await this.app.vault.read(node.abstractFile);
					const document = new Document({
						id: file.basename, text: content, metadata: new DocumentMetadata({
							source: Source.FILE,
							sourceId: file.basename,
							url: file.path,
							createdAt: file.stat.mtime.toString(),
							author: vaultName,
						}),
					})
					documentsForUpsert.push(document);
				}
			}
			const datastoreService: DataStore = ServiceLocator.getInstance().getService(ServiceLocator.DATASTORE_SERVICE);
			for(const doc of documentsForUpsert) {
				LOGGER.info("upserting:" + doc.id);
			}
			await datastoreService.upsert(documentsForUpsert);
			this.fileUIState.clearCheckedFiles();
			this.refresh();
		});
	}

	private refresh(){
		this.isBuilt = false;
		this.initialize();
	}

	private async initialize() {
		if (!this.isBuilt) {
			this.fileStateTree = await this.fileStateTreeBuilder.build();
			this.fileStateTree.printTree();
			this.isBuilt = true;
		}
	}

	private render() {
		this.rootContainer.empty();

		const syncRibbon = this.rootContainer.createDiv({cls: 'sync-ribbon'});
		const refreshButton = syncRibbon.createEl('button', {cls: 'sync-ribbon-refresh'});
		refreshButton.innerHTML = this.refreshIconSvg;
		refreshButton.addEventListener('click', async () => {
			console.log("not implemented yet")
		});
		const expandAllButton = syncRibbon.createEl('button', {cls: 'sync-ribbon-expand-all'});
		expandAllButton.innerHTML = this.expandAllIconSvg;
		expandAllButton.addEventListener('click', async () => {
			this.fileStateTree.getAllFolders().forEach(folder => {
				console.log("Expanded file: " + folder.abstractFile.path);
			})
		});
		const collapseAllButton = syncRibbon.createEl('button', {cls: 'sync-ribbon-collapse-all'});
		collapseAllButton.innerHTML = this.collapseAllIconSvg;
		collapseAllButton.addEventListener('click', async () => {
			this.fileStateTree.getAllFolders().forEach(folder => {
				console.log("Collapsed file: " + folder.abstractFile.path);
			})
		});
		const renderNode = (node: TreeNode, parentElement: HTMLUListElement, pathSoFar: string[], level: number, isFile = false, isFirstElement = false) => {
			const changeElement = parentElement.createDiv({
				cls: 'change-element-div',
				attr: {'change-element-node-identifier': node.abstractFile.path}
			});
			changeElement.style.marginLeft = `${level * this.indentation}px`;
			let rightArrowSpan: HTMLElement;
			let downArrowSpan: HTMLElement;
			if (!isFile) {
				rightArrowSpan = changeElement.createSpan({cls: 'change-element-arrow change-element-right-arrow'});
				rightArrowSpan.innerHTML = this.rightArrowSvg;

				downArrowSpan = changeElement.createSpan({cls: 'change-element-arrow change-element-down-arrow'});
				downArrowSpan.innerHTML = this.downArrowSvg;
				downArrowSpan.style.display = 'none';
			}

			const checkBox = changeElement.createEl('input', {
				type: 'checkbox',
				cls: 'change-element-checkbox',
				attr: {'data-file-path': node.abstractFile.path}
			});
			checkBox.addEventListener('change', async () => {
				console.log("Checkbox clicked for: " + node.abstractFile.path)
				console.log("Checkbox clicked name: " + node.abstractFile.name)
				const filePath = node.abstractFile.path;
				if (checkBox.checked) {
					await this.fileUIState.checkFile(filePath);
				} else {
					await this.fileUIState.uncheckFile(filePath);
				}
				await this.updateRelatedStates(node, checkBox.checked);
			});


			const iconSpan = changeElement.createSpan({cls: 'change-element-icon-span'});
			iconSpan.innerHTML = isFile ? this.fileIconSvg : this.folderIconSvg;


			changeElement.createSpan({
				text: node.abstractFile.name === '' ? 'Changes' : node.abstractFile.name,
				cls: 'change-element-text-span'
			});

			// Create a new UL for the children and append it to the current LI
			if (!isFile) {
				const childrenUl = parentElement.createEl('ul', {cls: 'changes-element'});

				const folderPath = node.abstractFile.path;
				this.fileUIState.collapseFolder(folderPath);
				childrenUl.style.display = 'none';
				const toggleNode = () => {
					this.fileUIState.toggleFolder(folderPath);
					if (!this.fileUIState.isFolderExpanded(folderPath)) {
						childrenUl.style.display = 'none';
						downArrowSpan.style.display = 'none';
						rightArrowSpan.style.display = 'inline-block';
					} else {
						childrenUl.style.display = 'block';
						downArrowSpan.style.display = 'inline-block';
						rightArrowSpan.style.display = 'none';
					}
				};

				// @ts-ignore
				rightArrowSpan.addEventListener('click', toggleNode);
				// @ts-ignore
				downArrowSpan.addEventListener('click', toggleNode);


				node.children.forEach(childNode => {
					renderNode(childNode, childrenUl, [...pathSoFar, node.abstractFile.name], level + 1, childNode.abstractFile instanceof TFile);
				});
			}
		}
		const rootUl = this.rootContainer.createDiv('changes-root');
		const changesElement = rootUl.createEl('ul', {cls: 'changes-element'});
		renderNode(this.fileStateTree.root, changesElement, [], 0, false, true);
	}

	private getChangeElementById = (path: string) => {
		return document.querySelector(`[change-element-node-identifier="${path}"]`) as HTMLDivElement;
	};

	private async updateRelatedStates(node: TreeNode, checked: boolean) {
		const filePath = node.abstractFile.path;

		const getCheckboxByFilePath = (path: string) => {
			return document.querySelector(`[data-file-path="${path}"]`) as HTMLInputElement;
		};

		const updateParentState = async (parentNode: TreeNode) => {
			let checkedCount = 0;
			let uncheckedCount = 0;

			for (const sibling of parentNode.children.values()) {
				const siblingPath = sibling.abstractFile.path;
				if (this.fileUIState.checkedFiles.has(siblingPath)) {
					checkedCount++;
				} else {
					uncheckedCount++;
				}
			}

			const parentCheckBox = getCheckboxByFilePath(parentNode.abstractFile.path);

			if (parentCheckBox) {
				if (checkedCount === parentNode.children.size) {
					parentCheckBox.checked = true;
					parentCheckBox.indeterminate = false;  // Set this last
					await this.fileUIState.checkFile(parentNode.abstractFile.path);
				} else if (uncheckedCount === parentNode.children.size) {
					parentCheckBox.checked = false;
					parentCheckBox.indeterminate = false;  // Set this last
					await this.fileUIState.uncheckFile(parentNode.abstractFile.path);
				} else {
					parentCheckBox.checked = false;  // Set this first
					parentCheckBox.indeterminate = true;  // Set this last
					// Optionally, update indeterminate state in FileUIState if you decide to keep track of it
				}
			}

			// If this node has a parent, update its state too.
			if (parentNode.parent) {
				await updateParentState(parentNode.parent);  // Recursive call
			}
		};


		// Update the current node's state.
		if (checked) {
			await this.fileUIState.checkFile(filePath);
		} else {
			await this.fileUIState.uncheckFile(filePath);
		}

		// Update children if it's a folder.
		if (!(node.abstractFile instanceof TFile)) {
			for (const child of node.children.values()) {
				const childCheckBox = getCheckboxByFilePath(child.abstractFile.path);
				if (childCheckBox) {
					childCheckBox.checked = checked;
					await this.updateRelatedStates(child, checked);
				}
			}
		}

		// Update parent state.
		if (node.parent) {
			await updateParentState(node.parent);
		}
	}


}
