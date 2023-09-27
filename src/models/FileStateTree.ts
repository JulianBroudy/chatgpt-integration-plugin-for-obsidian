import TreeNode, {FileState} from "./TreeNode";
import {TAbstractFile, TFolder} from "obsidian";
import {DocumentMetadata} from "./models";
import LOGGER from "../utils/Logger";


export default class FileStateTree {
	root: TreeNode;
	pathToNodeMap: Map<string, TreeNode>;

	constructor(root: TFolder) {
		this.root = new TreeNode(root);
		this.pathToNodeMap = new Map();
		this.pathToNodeMap.set(root.path, this.root);
	}

	addNode(abstractFile: TAbstractFile, fileState: FileState | null = null, documentMetadata: DocumentMetadata | null = null) {
		const parentPath = abstractFile.parent!.path;
		LOGGER.debug(`Trying to add node: ${abstractFile.name}, parent path: ${parentPath}`);

		let parentNode = this.pathToNodeMap.get(parentPath);

		// If parentNode is not found, create the missing parent nodes
		if (!parentNode) {
			LOGGER.debug(`Parent node NOT found for: ${abstractFile.name}. Creating parent nodes...`);
			parentNode = this.createMissingParentNodes(abstractFile.parent!);
		}

		if (parentNode) {
			LOGGER.debug(`Parent node found for: ${abstractFile.name}`);
			const newNode = new TreeNode(abstractFile, parentNode, fileState, documentMetadata);
			parentNode.addChild(newNode);
			this.pathToNodeMap.set(abstractFile.path, newNode);
		}
	}

	getAllFolders(): Set<TreeNode> {
		const folderSet = new Set<TreeNode>();

		for (const node of this.pathToNodeMap.values()) {
			if (node.abstractFile instanceof TFolder) {
				folderSet.add(node);
			}
		}

		return folderSet;
	}

	removeNode(abstractFile: TAbstractFile) {
		const node = this.pathToNodeMap.get(abstractFile.path);
		if (node && node.parent) {
			node.parent.children.delete(abstractFile.name);
			this.pathToNodeMap.delete(abstractFile.path);
		}
	}

	snapshotState() {
		// TODO: Implement snapshot logic
	}

	restoreFromSnapshot(snapshot: any) {
		// TODO: Implement restore logic
	}

	printTree(node: TreeNode = this.root, indentLevel = 0) {
		// Create an indentation string based on the current depth level
		const indent = ' '.repeat(indentLevel * 4);

		// Determine the type (Folder/File) and prepare additional info
		const type = node.abstractFile instanceof TFolder ? "Folder" : "File";
		const additionalInfo = type === "Folder" ? `${node.children.size} files` : "";

		// Print the current node with indentation
		LOGGER.debug(`${indent}- [${type}] ${node.abstractFile.name} ${additionalInfo}`);

		// Recursively print children
		node.children.forEach(childNode => {
			this.printTree(childNode, indentLevel + 1);
		});
	}

	logMapState() {
		LOGGER.debug("Current pathToNodeMap state:");
		this.pathToNodeMap.forEach((value, key) => {
			LOGGER.debug(`Key: ${key}, Value: ${value.abstractFile.name}`);
		});
	}

	getNode(path: string) {
		return this.pathToNodeMap.get(path);
	}

// Recursive function to create missing parent nodes
	private createMissingParentNodes(folder: TFolder): TreeNode {
		const parentPath = folder.parent!.path;

		let parentNode = this.pathToNodeMap.get(parentPath);

		// Create the parentNode if it doesn't exist, this is the recursive step
		if (!parentNode) {
			parentNode = this.createMissingParentNodes(folder.parent!);
		}

		// At this point, parentNode is guaranteed to exist
		const newNode = new TreeNode(folder, parentNode);
		parentNode.addChild(newNode);
		this.pathToNodeMap.set(folder.path, newNode);

		return newNode;
	}
}
