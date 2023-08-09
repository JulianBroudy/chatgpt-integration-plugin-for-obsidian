import {App, Editor, MarkdownView, Modal, Notice, Plugin, TFile} from 'obsidian';
import * as dotenv from 'dotenv';
import * as process from 'process';
import LOGGER from './utils/Logger';
import {DataStore} from './services/datastore';
import {ChatGPTEnablerSettings} from 'src/interfaces/ISettings';
import {ChatGPTEnablerSettingsTab} from 'src/api/SettingsTab';
import {Document, DocumentMetadata} from './models/models';
import ServiceLocator from "./utils/ServiceLocator";
import {OpenAI} from "./services/openai";
import {Chunks} from "./services/chunks";
import {DatabasePolling} from "./services/DatabasePolling";
import {UIController} from "./services/UIController";

dotenv.config({path: 'X:\\Development\\Projects\\Testing Obsidian Plugins\\.obsidian\\plugins\\obsidian-chatgpt-enabler-plugin\\.env'});

const DEFAULT_SUPABASE_URL = 'http://localhost:54321';
const DEFAULT_SETTINGS: Partial<ChatGPTEnablerSettings> = {
	openAIApiKey: {
		value: process.env.OPENAI_API_KEY || '', isVisible: false
	}, supabaseUrl: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, supabaseKeys: {
		anonKey: {
			value: process.env.SUPABASE_ANON_KEY || '', isVisible: false
		}, serviceRoleKey: {
			value: process.env.SUPABASE_SERVICE_ROLE_KEY || '', isVisible: false
		}, currentlyActiveKey: 'serviceRoleKey',
	}
}


export default class ChatGPTEnablerPlugin extends Plugin {

	settings: ChatGPTEnablerSettings;
	serviceLocator: ServiceLocator;


	async onload() {
		await this.loadSettings();
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ChatGPTEnablerSettingsTab(this.app, this));

		this.serviceLocator = ServiceLocator.getInstance();

		const openAiService = new OpenAI(this.settings);
		this.serviceLocator.registerService(ServiceLocator.OPEN_AI_SERVICE, openAiService);
		const chunkifyingService = new Chunks(this.settings, openAiService);
		this.serviceLocator.registerService(ServiceLocator.CHUNKIFYING_SERVICE, chunkifyingService);
		const dataStoreService = new DataStore(this.settings, chunkifyingService);
		this.serviceLocator.registerService(ServiceLocator.DATASTORE_SERVICE, dataStoreService);
		const databasePollingService = new DatabasePolling(dataStoreService, 5);
		this.serviceLocator.registerService(ServiceLocator.DATABASE_POLLING_SERVICE, databasePollingService);
		const uiController = new UIController(this);
		this.serviceLocator.registerService(ServiceLocator.UI_CONTROLLER, uiController);

		uiController.createSyncingIcons();



		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('ChatGPTEnabler');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple', name: 'Open sample modal (simple)', callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});


		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
//		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
//			console.log('click', evt);
//		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
//		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));


		LOGGER.silly("onload()");
		this.addCommand({
			id: 'list-all-files', name: 'List All Files', callback: () => {
				this.listAllFiles();
			}
		});

		this.addCommand({
			id: 'convert-files-to-documents', name: 'Convert Files to Documents', callback: () => {
				this.convertFilesToDocuments();
			}
		});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const ribbonIconEl = this.addRibbonIcon('lines-of-text', 'List All Files', (evt: MouseEvent) => {
			this.listAllFiles();
		});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const ribbonIconEl2 = this.addRibbonIcon('file-text', 'Convert Files to Documents', (evt: MouseEvent) => {
			this.convertFilesToDocuments();
		});





		const pollingButton = this.addStatusBarItem();
		const iconContainer = pollingButton.createEl('span');

// Set the inner HTML to the Lucide icon's SVG code with adjusted size
		iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw-off"><path d="M21 8L18.74 5.74A9.75 9.75 0 0 0 12 3C11 3 10.03 3.16 9.13 3.47"/><path d="M8 16H3v5"/><path d="M3 12C3 9.51 4 7.26 5.64 5.64"/><path d="m3 16 2.26 2.26A9.75 9.75 0 0 0 12 21c2.49 0 4.74-1 6.36-2.64"/><path d="M21 12c0 1-.16 1.97-.47 2.87"/><path d="M21 3v5h-5"/><path d="M22 22 2 2"/></svg>`;

		pollingButton.addEventListener('click', () => {
			// Toggle the polling service
			databasePollingService.toggle();

			// Toggle the spinning state based on the polling state
			if (databasePollingService.isActive()) {
				iconContainer.addClass('spin-animation'); // Start spinning
			} else {
				iconContainer.removeClass('spin-animation'); // Stop spinning
			}
		});

		pollingButton.addClass('mod-clickable');


		// this.listAllFiles();

		databasePollingService.activate();

		// dataStoreService.pollCommand();
	}


	onunload() {
		const pollingService: DatabasePolling = this.serviceLocator.getService(ServiceLocator.DATABASE_POLLING_SERVICE);
		pollingService.deactivate();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		const documents: Document[] = [];
		const vaultName = this.app.vault.getName();
		for (const file of this.app.vault.getFiles()) {
			if (file.extension === 'md' && file.basename !== 'logs') {
				const content = await this.app.vault.read(file);
				LOGGER.info("File: " + file.path);
				const document = new Document({
					id: file.basename, text: content, metadata: new DocumentMetadata({
						source: 'file', sourceId: file.path, createdAt: file.stat.mtime.toString(), author: vaultName,
					}),
				});
				documents.push(document);
				log += JSON.stringify(document) + '\n';
			}
		}
		await this.writeLog(log);
//		await this.datastore.upsert('documents', documents);
		new Notice('Yayy! Your files have been updated! 😎')
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
