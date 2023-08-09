import ChatGPTEnablerPlugin from "../main";
import ServiceLocator from "../utils/ServiceLocator";
import {DatabasePolling} from "./DatabasePolling";


export class UIController {

	pollingServiceRibbonIconEL: HTMLElement;
	pollingServiceStatusBarIconEL: HTMLElement;
	plugin;
	pollingService: DatabasePolling;
	private syncingIconSVGElements: SyncingIconSVGElements[] = [];


	constructor(plugin: ChatGPTEnablerPlugin) {
		this.plugin = plugin;
		this.pollingService = ServiceLocator.getInstance().getService(ServiceLocator.DATABASE_POLLING_SERVICE);
	}

	createSyncingIcons() {
		this.createPollingServiceRibbonIcon();
		this.createPollingServiceStatusBarIcon();
	}

	createPollingServiceRibbonIcon() {
		this.pollingServiceRibbonIconEL = this.plugin.addRibbonIcon('lucide-refresh-cw', 'Toggle Polling Service', (evt: MouseEvent) => {
			this.togglePollingService();
		});
		this.pollingServiceRibbonIconEL.innerHTML = this.getSyncingIcon(24, 24, true);
		this.syncingIconSVGElements.push({
			syncingIconSVGElement: this.pollingServiceRibbonIconEL.querySelector('.lucide-refresh-cw') as SVGSVGElement,
			syncingIconSlashSVGElement: this.pollingServiceRibbonIconEL.querySelector('.slash') as SVGSVGElement
		});
	}


	createPollingServiceStatusBarIcon() {
		this.pollingServiceStatusBarIconEL = this.plugin.addStatusBarItem();
		this.pollingServiceStatusBarIconEL.innerHTML = '<span class="icon-text">ChatGPTEnabler</span>' + this.getSyncingIcon(12, 12);
		this.pollingServiceStatusBarIconEL.addEventListener('click', () => {
			// Toggle the polling service
			this.togglePollingService();
		});
		this.pollingServiceStatusBarIconEL.addClass('mod-clickable');
		this.syncingIconSVGElements.push({
			syncingIconSVGElement: this.pollingServiceStatusBarIconEL.querySelector('.lucide-refresh-cw') as SVGSVGElement,
			syncingIconSlashSVGElement: this.pollingServiceStatusBarIconEL.querySelector('.slash') as SVGSVGElement
		});
	}

	getSyncingIcon(width: number, height: number, ribbonIcon = false) {
		return `<div class="icon-wrapper">
				   <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${ribbonIcon ? 'svg-icon ' : ''}lucide-refresh-cw spin-animation">
					  <path d="M21 2v6h-6"></path>
					  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
					  <path d="M3 22v-6h6"></path>
					  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
				   </svg>
				   <svg class="slash${ribbonIcon ? ' svg-icon' : ''}" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					  <path id="inactive-slash" d="M2 22 22 2"></path>
				   </svg>
				</div>`;
	}

	private togglePollingService() {
		this.pollingService.toggle();
		this.toggleSyncingIcon(this.pollingService.isActive());
	}

	private toggleSyncingIcon(activate: boolean) {
		for (const pair of this.syncingIconSVGElements) {
			if (activate) {
				pair.syncingIconSlashSVGElement.style.display = 'none'; // Hide the slash
				pair.syncingIconSVGElement.style.animationPlayState = 'running'; // Resume animation
			} else {
				pair.syncingIconSVGElement.style.animationPlayState = 'paused'; // Pause animation
				pair.syncingIconSlashSVGElement.style.display = ''; // Show the slash
			}
		}
	}
}

interface SyncingIconSVGElements {
	syncingIconSVGElement: SVGElement;
	syncingIconSlashSVGElement: SVGElement;
}
