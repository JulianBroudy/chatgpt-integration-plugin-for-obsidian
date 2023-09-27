import {Plugin} from 'obsidian';
import * as dotenv from 'dotenv';
import * as process from 'process';
import {DataStore} from './services/datastore';
import {ChatGPTEnablerSettings} from 'src/interfaces/ISettings';
import {ChatGPTEnablerSettingsTab} from 'src/api/SettingsTab';
import ServiceLocator from "./utils/ServiceLocator";
import {OpenAI} from "./services/openai";
import {Chunks} from "./services/chunks";
import {DatabasePolling} from "./services/DatabasePolling";
import {UIController} from "./services/UIController";
import {CommandHandler} from "./services/CommandHandler";
import FileStateTreeBuilder from "./services/FileStateTreeBuilder";
import {SyncView, VIEW_TYPE_SYNC_VIEW} from "./api/SyncView";

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
		const commandHandlingService = new CommandHandler(this.settings, dataStoreService);
		this.serviceLocator.registerService(ServiceLocator.COMMAND_HANDLING_SERVICE, commandHandlingService);
		const databasePollingService = new DatabasePolling(dataStoreService, commandHandlingService, 5);
		this.serviceLocator.registerService(ServiceLocator.DATABASE_POLLING_SERVICE, databasePollingService);
		const uiController = new UIController(this, databasePollingService);
		this.serviceLocator.registerService(ServiceLocator.UI_CONTROLLING_SERVICE, uiController);

		uiController.createSyncingIcons();
		databasePollingService.activate();

		const fileStateTreeBuilder = new FileStateTreeBuilder(dataStoreService);
		this.registerView(
			VIEW_TYPE_SYNC_VIEW,
			(leaf) => new SyncView(leaf, fileStateTreeBuilder)
		);

		this.addRibbonIcon("dice", "Activate view", () => {
			this.activateView();
		});
	}


	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_SYNC_VIEW);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_SYNC_VIEW,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_SYNC_VIEW)[0]
		);
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

}
