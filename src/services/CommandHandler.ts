import {FileManager, Vault} from "obsidian";
import {CommandType, CommandWithContent, Document, DocumentMetadata, Source} from "../models/models";
import LOGGER from "../utils/Logger";
import {ChatGPTEnablerSettings} from "../interfaces/ISettings";
import {DataStore} from "./datastore";

export class CommandHandler {

	private settings: ChatGPTEnablerSettings;
	private vault: Vault;
	private fileManager: FileManager;
	private datastore: DataStore;

	constructor(settings: ChatGPTEnablerSettings, dataStoreService: DataStore) {
		this.settings = settings;
		this.datastore = dataStoreService;
		this.vault = app.vault;
		this.fileManager = app.fileManager;
	}

	async handleNewCommand(command: CommandWithContent): Promise<boolean> {
		// Handle the command logic here
		LOGGER.info('Handling command:', command);

		switch (command.type) {
			case CommandType.CREATE_NOTE: {
				const commandContent = command.content;
				const documentMetadata = commandContent.metadata;
				let newMarkdownFileName: string;
				if (documentMetadata.sourceId) {
					newMarkdownFileName = documentMetadata.sourceId;
				} else if (this.settings.newMarkdownFileFolderLocation) {
					newMarkdownFileName = this.settings.newMarkdownFileFolderLocation;
				} else {
					newMarkdownFileName = this.fileManager.getNewFileParent('').path;
					LOGGER.info('haha');
				}
				newMarkdownFileName += '/' + (command.id ? command.id : 'ChatGPT Note #' + (Math.floor(Math.random() * (9999 - 1 + 1)) + 1)) + '.md';
				LOGGER.silly('newMarkdownFileName = ' + newMarkdownFileName);
				const newFile = await this.vault.create(newMarkdownFileName, commandContent.text);

				const documents: Document[] = [];
				const document = new Document({
					id: newFile.basename, text: commandContent.text, metadata: new DocumentMetadata({
						source: Source.CHAT, sourceId: newFile.path, createdAt: newFile.stat.mtime.toString(), author: this.vault.getName(),
					}),
				});
				documents.push(document);
				await this.datastore.upsert('documents', documents);
				return true;
			}
		}
		return false;
	}

}
