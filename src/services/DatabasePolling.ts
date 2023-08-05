import IUpdatableClient from "../interfaces/IUpdatableClient";
import {DataStore} from "./datastore";
import {CommandStatus, CommandWithContent} from "../models/models";
import LOGGER from 'src/utils/Logger';

export class DatabasePolling implements IUpdatableClient {
	private datastore: DataStore;
	private pollIntervalSeconds: number;
	private isActive;

	constructor(datastore: DataStore, pollIntervalSeconds: number) {
		this.datastore = datastore;
		this.isActive = false;
		this.pollIntervalSeconds = pollIntervalSeconds;
		LOGGER.info('DatabasePoller initialized with poll interval:', pollIntervalSeconds, 'seconds');
	}

	updateClient(): Promise<void> {
		return Promise.resolve(undefined);
	}

	activate() {
		this.isActive = true;
		this.startPolling();
		LOGGER.info('DatabasePoller activated');
	}

	deactivate() {
		this.isActive = false;
		LOGGER.info('DatabasePoller deactivated');
	}

	toggle() {
		if (this.isActive) {
			this.deactivate();
		} else {
			this.activate();
		}
	}


	private setPollIntervalSeconds(newIntervalSeconds: number) {
		LOGGER.info('Updating poll interval from', this.pollIntervalSeconds, 'to', newIntervalSeconds, 'seconds');
		this.pollIntervalSeconds = newIntervalSeconds;
	}

	private startPolling() {
		LOGGER.silly("Entering startPolling...");
		if (!this.isActive) return;

		LOGGER.debug("Polling datastore for command.");
		this.datastore.pollCommand().then((command) => {
			if (command) {
				LOGGER.info('Command received:', command);
				return this.handleCommand(command).then(() => {
					this.datastore.updateCommandStatus(command.id!, CommandStatus.COMPLETED);
					LOGGER.info('Command completed:', command);
				});
			}
		}).catch((error) => {
			LOGGER.error('Error in polling:', error);
		}).finally(() => {
			// Schedule the next polling attempt, whether a command was found or not
			setTimeout(() => this.startPolling(), this.pollIntervalSeconds * 1000);
		});
	}

	private async handleCommand(command: CommandWithContent) {
		// Handle the command logic here
		LOGGER.info('Handling command:', command);
	}

}

