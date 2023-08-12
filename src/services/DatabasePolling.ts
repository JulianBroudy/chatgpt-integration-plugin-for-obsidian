import IUpdatableClient from "../interfaces/IUpdatableClient";
import {DataStore} from "./datastore";
import {CommandStatus, CommandWithContent} from "../models/models";
import LOGGER from 'src/utils/Logger';
import {CommandHandler} from "./CommandHandler";

export class DatabasePolling implements IUpdatableClient {
	private datastore: DataStore;
	private pollIntervalSeconds: number;
	private active;
	private commandHandlingService: CommandHandler;

	constructor(datastore: DataStore, commandHandlingService: CommandHandler, pollIntervalSeconds: number) {
		this.datastore = datastore;
		this.active = false;
		this.pollIntervalSeconds = pollIntervalSeconds;
		this.commandHandlingService = commandHandlingService;
		LOGGER.info('DatabasePoller initialized with poll interval:', pollIntervalSeconds, 'seconds');
	}

	updateClient(): Promise<void> {
		return Promise.resolve(undefined);
	}

	activate() {
		this.active = true;
		this.startPolling();
		LOGGER.info('DatabasePoller activated');
	}

	deactivate() {
		this.active = false;
		LOGGER.info('DatabasePoller deactivated');
	}

	toggle() {
		if (this.active) {
			this.deactivate();
		} else {
			this.activate();
		}
	}

	isActive() {
		return this.active;
	}


	private setPollIntervalSeconds(newIntervalSeconds: number) {
		LOGGER.info('Updating poll interval from', this.pollIntervalSeconds, 'to', newIntervalSeconds, 'seconds');
		this.pollIntervalSeconds = newIntervalSeconds;
	}

	private startPolling() {
		LOGGER.silly("Entering startPolling...");
		if (!this.active) return;

		let commandWithContent: CommandWithContent;
		let commandId: string;
		LOGGER.debug("Polling datastore for command.");
		this.datastore.pollCommand().then((command) => {
			if (command) {
				LOGGER.info('Command received:', command);
				commandWithContent = command;
				commandId = <string>command.id;
				return this.commandHandlingService.handleNewCommand(command).then((success: boolean) => {
					if (success) {
						this.datastore.updateCommandStatus(command.id!, CommandStatus.COMPLETED);
						LOGGER.info('Command completed:', command);
					} else {
						this.datastore.updateCommandStatus(command.id!, CommandStatus.ERROR);
						LOGGER.info('Command was NOT completed:', command);
					}
				});
			}
		}).catch((error) => {
			LOGGER.error('Error in polling:', error);
			this.datastore.updateCommandStatus(commandId, CommandStatus.ERROR);
			LOGGER.info('Command was NOT completed:', commandWithContent);
		}).finally(() => {
			// Schedule the next polling attempt, whether a command was found or not
			setTimeout(() => this.startPolling(), this.pollIntervalSeconds * 1000);
		});
	}


}

