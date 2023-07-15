import {App, PluginSettingTab, Setting} from "obsidian";
import ChatGPTEnablerPlugin from "main";
import {SensitiveConfiguration} from "interfaces/ISettings";
import {forEach} from "builtin-modules";
import ServiceLocator from "../utils/ServiceLocator";
import IUpdatableClient from "../interfaces/IUpdatableClient";

export class ChatGPTEnablerSettingsTab extends PluginSettingTab {
	private plugin: ChatGPTEnablerPlugin;

	constructor(app: App, plugin: ChatGPTEnablerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

//		containerEl.createEl('h1', {text: 'ChatGPT Enabler Settings'});

		containerEl.createEl('h3', {text: 'Connections & Secrets'});
		containerEl.createEl('h2', {text: 'OpenAI'});
		this.addSensitiveConfigField(new Setting(containerEl), 'OpenAI API Key', 'It\'s a secret', this.plugin.settings.openAIApiKey);
		const openAISaveButtonDiv = containerEl.createDiv({cls: 'save-button-div'});
		const openAISaveButton = openAISaveButtonDiv.createEl('button', {
			text: 'Update OpenAI API Key',
			cls: 'mod-cta'
		});
		openAISaveButton.addEventListener('click', async () => {
			await this.plugin.saveSettings();
			await this.updateServices(ServiceLocator.OPEN_AI_SERVICE);
			// TODO add error handling
		});

		containerEl.createEl('h2', {text: 'Supabase'});
		new Setting(containerEl)
			.setName('Supabase Key Choice')
			.setDesc('Choose which Supabase key to use.')
			.addDropdown(dropdown => {
				dropdown.addOption('anonKey', 'Anon Key');
				dropdown.addOption('serviceRoleKey', 'Service Role Key');
				dropdown.setValue(this.plugin.settings.supabaseKeys.currentlyActiveKey);
				dropdown.onChange(async (value) => {
					this.plugin.settings.supabaseKeys.currentlyActiveKey = value as "anonKey" | "serviceRoleKey";
					await this.plugin.saveSettings();
				});
			});

		this.addSensitiveConfigField(new Setting(containerEl), 'Supabase Anon Key', 'It\'s a secret', this.plugin.settings.supabaseKeys.anonKey);
		this.addSensitiveConfigField(new Setting(containerEl), 'Supabase Service Role Key', 'It\'s a secret', this.plugin.settings.supabaseKeys.serviceRoleKey);

		const supabaseSaveButtonDiv = containerEl.createDiv({cls: 'save-button-div'});
		const supabaseSaveButton = supabaseSaveButtonDiv.createEl('button', {
			text: 'Connect/Renew Supabase Connection',
			cls: 'mod-cta'
		});
		supabaseSaveButton.addEventListener('click', async () => {
			await this.plugin.saveSettings();
			await this.updateServices(ServiceLocator.DATASTORE_SERVICE);
			// TODO add error handling
		});
	}

	addSensitiveConfigField(setting: Setting, name: string, desc: string, config: SensitiveConfiguration) {
		setting.setName(name)
			.setDesc(desc)
			.addText(text => text
				.setPlaceholder(`Enter your ${name}`)
				.setValue(config.value)
				.onChange(async (value) => {
					console.log(`${name}: ${value}`);
					config.value = value;
					await this.plugin.saveSettings();
				})
				.inputEl.type = config.isVisible ? 'text' : 'password')
			.addExtraButton(button => button
				.setIcon(config.isVisible ? 'eye-off' : 'eye')
				.onClick(async () => {
					// Toggle the visibility of the config when the button is clicked
					config.isVisible = !config.isVisible;
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings tab
				}))
	}

	async updateServices(...serviceNames: string[]): Promise<void> {
		const updatableClients: Promise<void>[] = [];
		for (const serviceName of serviceNames) {
			const service = ServiceLocator.getInstance().getService<IUpdatableClient>(serviceName);
			updatableClients.push(service.updateClient());
		}
		await Promise.all(updatableClients);
	}
}
