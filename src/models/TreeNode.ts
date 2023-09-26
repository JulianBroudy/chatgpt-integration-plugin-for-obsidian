import {TAbstractFile} from "obsidian";
import {DocumentMetadata} from "./models";

export enum FileState {
	NEW = "NEW",
	MODIFIED = "MODIFIED",
	DELETED = "DELETED"
}

export default class TreeNode {
	parent: TreeNode | null;
	children: Map<string, TreeNode>;  // key is the name of the file or folder
	abstractFile: TAbstractFile;  // Obsidian file or folder
	fileState: FileState | null;  // State of the file
	documentMetadata: DocumentMetadata | null;

	constructor(abstractFile: TAbstractFile, parent: TreeNode | null = null, fileState: FileState | null = null, documentMetadata: DocumentMetadata | null = null) {
		this.abstractFile = abstractFile;
		this.documentMetadata = documentMetadata;
		this.fileState = fileState;
		this.parent = parent;
		this.children = new Map();
	}

	// Add a child to this node
	addChild(child: TreeNode) {
		this.children.set(child.abstractFile.name, child);
	}
}
