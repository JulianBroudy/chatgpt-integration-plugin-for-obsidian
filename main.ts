import { App, Plugin, TFile } from 'obsidian';
import { Document, DocumentMetadata } from './models/models';
import { MergedDataStore } from 'api/datastore';


export default class MyPlugin extends Plugin {

	datastore = new MergedDataStore();

	async onload() {
		this.addCommand({
			id: 'list-all-files',
			name: 'List All Files',
			callback: () => {
				this.listAllFiles();
			}
		});

		this.addCommand({
			id: 'convert-files-to-documents',
			name: 'Convert Files to Documents',
			callback: () => {
				this.convertFilesToDocuments();
			}
		});

		const ribbonIconEl = this.addRibbonIcon('lines-of-text', 'List All Files', (evt: MouseEvent) => {
			this.listAllFiles();
		});

		const ribbonIconEl2 = this.addRibbonIcon('file-text', 'Convert Files to Documents', (evt: MouseEvent) => {
			this.convertFilesToDocuments();
		});

		this.listAllFiles();
	}

	async listAllFiles() {
		let log = '';
		this.app.vault.getFiles().forEach((file: TFile) => {
			log += file.path + '\n';
		});
		await this.writeLog(log);
	}

	async convertFilesToDocuments() {
		let log = '';
		let documents: Document[] = [];
		for (const file of this.app.vault.getFiles()) {
			if (file.extension === 'md') {
				const content = await this.app.vault.read(file);
				const document = new Document({
					id: file.basename,
					text: content,
					metadata: new DocumentMetadata({
						source: 'file',
						source_id: file.path,
						created_at: file.stat.mtime.toString(),
					}),
				});
				documents.push(document);
				log += JSON.stringify(document) + '\n';
			}
		}
		await this.writeLog(log);
		await this.datastore.upsert('documents',documents);
		await this.writeLog('Finished upsert');
	}

	async writeLog(log: string) {
		const logFile = this.app.vault.getAbstractFileByPath('logs.md');
		if (logFile instanceof TFile) {
			const currentContent = await this.app.vault.read(logFile);
			const newContent = currentContent + '\n---\n' + log;
			await this.app.vault.modify(logFile, newContent);
		} else {
			await this.app.vault.create('logs.md', log);
		}
	}
}