import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';

interface TimecountSettings {
    storageLocation: string;
    trackingEnabled: boolean;
    showNotifications: boolean;
    sessionTimeout: number; // minutes of inactivity before ending session
}

interface TimeSession {
    date: string;
    startTime: number;
    endTime: number;
    duration: number; // in milliseconds
    activeFile?: string;
}

interface DailyTimeData {
    date: string;
    totalTime: number;
    sessions: TimeSession[];
}

const DEFAULT_SETTINGS: TimecountSettings = {
    storageLocation: 'timecount-data.json',
    trackingEnabled: true,
    showNotifications: true,
    sessionTimeout: 5
};

export default class TimecountPlugin extends Plugin {
    settings: TimecountSettings;
    private currentSession: TimeSession | null = null;
    private lastActivity: number = 0;
    private activityCheckInterval: NodeJS.Timeout | null = null;
    private timeData: DailyTimeData[] = [];
	private statusBarItem: HTMLElement | null = null;
	private statusBarUpdateInterval: NodeJS.Timeout | null = null;

    async onload() {
        await this.loadSettings();
        await this.loadTimeData();

        // Add ribbon icon
        this.addRibbonIcon('clock', 'Timecount', (evt: MouseEvent) => {
            this.showTimeStats();
        });
		
		// Add status bar info
		this.statusBarUpdateInterval = setInterval(() => {
			this.updateStatusBar();
		}, 1000); // Update every second
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setText('0h 0m');

        // Add commands
        this.addCommand({
            id: 'start-timecount',
            name: 'Start Timecount',
            callback: () => this.startTracking()
        });

        this.addCommand({
            id: 'stop-timecount',
            name: 'Stop Timecount',
            callback: () => this.stopTracking()
        });

        this.addCommand({
            id: 'show-timecount-stats',
            name: 'Show Timecount statistics',
            callback: () => this.showTimeStats()
        });

        this.addCommand({
            id: 'reset-timecount-data',
            name: 'Reset Timecount data',
            callback: () => this.resetTimeData()
        });

        // Add settings tab
        this.addSettingTab(new TimecountSettingTab(this.app, this));

        // Set up activity tracking
        this.setupActivityTracking();

        // Start tracking if enabled
        if (this.settings.trackingEnabled) {
            this.startTracking();
        }
    }

    onunload() {
        this.stopTracking();
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
        }

		if (this.statusBarUpdateInterval) {
			clearInterval(this.statusBarUpdateInterval);
		}
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async loadTimeData() {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.settings.storageLocation);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                this.timeData = JSON.parse(content);
            }
        } catch (error) {
            console.log('No existing time data found or error loading:', error);
            this.timeData = [];
        }

		this.updateStatusBar();
    }

    private async saveTimeData() {
        try {
            const content = JSON.stringify(this.timeData, null, 2);
            const file = this.app.vault.getAbstractFileByPath(this.settings.storageLocation);
            
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(this.settings.storageLocation, content);
            }
        } catch (error) {
            console.error('Error saving time data:', error);
        }
    }

    private setupActivityTracking() {
        // Track various user activities
        const trackActivity = () => {
            this.lastActivity = Date.now();
        };

        // Listen for file changes, clicks, key presses
        this.registerDomEvent(document, 'click', trackActivity);
        this.registerDomEvent(document, 'keydown', trackActivity);
        this.registerDomEvent(window, 'focus', trackActivity);

        // Check for inactivity every 30 seconds
        this.activityCheckInterval = setInterval(() => {
            this.checkInactivity();
        }, 30000);
    }

    private checkInactivity() {
        if (!this.currentSession) return;

        const inactiveTime = Date.now() - this.lastActivity;
        const timeoutMs = this.settings.sessionTimeout * 60 * 1000;

        if (inactiveTime > timeoutMs) {
            this.endCurrentSession();
            if (this.settings.showNotifications) {
                new Notice('Timecount paused due to inactivity');
            }
        }
    }

    private startTracking() {
        if (this.currentSession) {
            return; // Already tracking
        }

        const now = Date.now();
        const activeFile = this.app.workspace.getActiveFile();

        this.currentSession = {
            date: new Date().toISOString().split('T')[0],
            startTime: now,
            endTime: now,
            duration: 0,
            activeFile: activeFile?.path
        };

        this.lastActivity = now;

        if (this.settings.showNotifications) {
            new Notice('Timecount started');
        }

		this.updateStatusBar();
    }

    private stopTracking() {
        if (!this.currentSession) return;

        this.endCurrentSession();

        if (this.settings.showNotifications) {
            new Notice('Timecount stopped');
        }
    }

    private endCurrentSession() {
        if (!this.currentSession) return;

        const now = Date.now();
        this.currentSession.endTime = now;
        this.currentSession.duration = now - this.currentSession.startTime;

        // Find or create daily data entry
        const today = this.currentSession.date;
        let dailyData = this.timeData.find(d => d.date === today);

        if (!dailyData) {
            dailyData = {
                date: today,
                totalTime: 0,
                sessions: []
            };
            this.timeData.push(dailyData);
        }

        // Add session to daily data
        dailyData.sessions.push({ ...this.currentSession });
        dailyData.totalTime += this.currentSession.duration;

		this.updateStatusBar();

        // Save data
        this.saveTimeData();

        // Clear current session
        this.currentSession = null;
    }

    private showTimeStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayData = this.timeData.find(d => d.date === today);
        
        let message = `📊 Timecount Statistics\n\n`;
        
        // Today's stats
        let todayTotal = 0;
        if (todayData) {
            todayTotal = todayData.totalTime;
        }
        
        // Add current session time if active
        if (this.currentSession) {
            todayTotal += Date.now() - this.currentSession.startTime;
        }
        
        const todayHours = Math.floor(todayTotal / (1000 * 60 * 60));
        const todayMinutes = Math.floor((todayTotal % (1000 * 60 * 60)) / (1000 * 60));
        message += `📅 Today: ${todayHours}h ${todayMinutes}m\n`;
        
        if (todayData) {
            message += `🔄 Sessions: ${todayData.sessions.length}\n`;
        }
        
        // All time total
        const allTimeTotal = this.calculateAllTimeTotal();
        const allTimeHours = Math.floor(allTimeTotal / (1000 * 60 * 60));
        const allTimeMinutes = Math.floor((allTimeTotal % (1000 * 60 * 60)) / (1000 * 60));
        message += `⏰ All Time: ${allTimeHours}h ${allTimeMinutes}m\n\n`;

        // Show last 7 days
        const last7Days = this.timeData
            .filter(d => {
                const date = new Date(d.date);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 7);

        if (last7Days.length > 0) {
            message += `📈 Last 7 days:\n`;
            last7Days.forEach(day => {
                const hours = Math.floor(day.totalTime / (1000 * 60 * 60));
                const minutes = Math.floor((day.totalTime % (1000 * 60 * 60)) / (1000 * 60));
                message += `${day.date}: ${hours}h ${minutes}m\n`;
            });
        }

        if (this.currentSession) {
            const currentDuration = Date.now() - this.currentSession.startTime;
            const currentHours = Math.floor(currentDuration / (1000 * 60 * 60));
            const currentMinutes = Math.floor((currentDuration % (1000 * 60 * 60)) / (1000 * 60));
            message += `\n⏱️ Current session: ${currentHours}h ${currentMinutes}m`;
        }

        new Notice(message, 10000);
    }

    private calculateAllTimeTotal(): number {
        // Sum all completed sessions from all days
        let totalTime = this.timeData.reduce((sum, day) => sum + day.totalTime, 0);

        // Add current session time if active
        if (this.currentSession) {
            totalTime += Date.now() - this.currentSession.startTime;
        }

        return totalTime;
    }

    private calculateTodayTotal(): number {
        const today = new Date().toISOString().split('T')[0];
        const todayData = this.timeData.find(d => d.date === today);
        
        let todayTotal = 0;
        if (todayData) {
            todayTotal = todayData.totalTime;
        }
        
        // Add current session time if active
        if (this.currentSession) {
            todayTotal += Date.now() - this.currentSession.startTime;
        }
        
        return todayTotal;
    }
	
	// Method to format milliseconds
	private formatTime(milliseconds: number): string {
		const hours = Math.floor(milliseconds / (1000 * 60 * 60));
		const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	}

	private updateStatusBar(): void {
		if (!this.statusBarItem) return;

		const allTimeTotal = this.calculateAllTimeTotal();
		const todayTotal = this.calculateTodayTotal();
		
		// Show all time total with today's time in parentheses
		const allTimeFormatted = this.formatTime(allTimeTotal);
		const todayFormatted = this.formatTime(todayTotal);
		
		this.statusBarItem.setText(`⏰ ${allTimeFormatted} (${todayFormatted})`);
		this.statusBarItem.title = `All time: ${allTimeFormatted}\nToday: ${todayFormatted}`;
	}

    private async resetTimeData() {
        const confirmReset = await this.showConfirmDialog(
            'Reset Timecount Data',
            'Are you sure you want to reset all time tracking data? This action cannot be undone.'
        );

        if (confirmReset) {
            this.timeData = [];
            this.currentSession = null;
            await this.saveTimeData();
            this.updateStatusBar();
            new Notice('Timecount data has been reset');
        }
    }

    private showConfirmDialog(title: string, message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmModal(this.app, title, message, resolve);
            modal.open();
        });
    }
}

class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private resolve: (value: boolean) => void;

    constructor(app: App, title: string, message: string, resolve: (value: boolean) => void) {
        super(app);
        this.title = title;
        this.message = message;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });
        
        const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });
        
        const confirmButton = buttonContainer.createEl('button', { text: 'Reset', cls: 'mod-warning' });
        confirmButton.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

import { Modal } from 'obsidian';

class TimecountSettingTab extends PluginSettingTab {
    plugin: TimecountPlugin;

    constructor(app: App, plugin: TimecountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Timecount Settings' });

        new Setting(containerEl)
            .setName('Enable Timecount')
            .setDesc('Automatically track time spent in Obsidian')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.trackingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.trackingEnabled = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        this.plugin.startTracking();
                    } else {
                        this.plugin.stopTracking();
                    }
                }));

        new Setting(containerEl)
            .setName('Show notifications')
            .setDesc('Show notifications when tracking starts/stops')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Session timeout (minutes)')
            .setDesc('Minutes of inactivity before ending the current session')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.settings.sessionTimeout)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.sessionTimeout = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Storage location')
            .setDesc('File path where Timecount data will be stored')
            .addText(text => text
                .setPlaceholder('timecount-data.json')
                .setValue(this.plugin.settings.storageLocation)
                .onChange(async (value) => {
                    this.plugin.settings.storageLocation = value || 'timecount-data.json';
                    await this.plugin.saveSettings();
                }));

        // Add statistics section
        containerEl.createEl('h3', { text: 'Statistics' });
        
        const statsContainer = containerEl.createDiv();
        this.updateStatsDisplay(statsContainer);

        // Add export button
        new Setting(containerEl)
            .setName('Export data')
            .setDesc('Export Timecount data as JSON')
            .addButton(button => button
                .setButtonText('Export')
                .onClick(async () => {
                    try {
                        const data = JSON.stringify(this.plugin.timeData, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `timecount-data-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        new Notice('Timecount data exported successfully');
                    } catch (error) {
                        new Notice('Error exporting data');
                        console.error(error);
                    }
                }));

        // Add reset button
        new Setting(containerEl)
            .setName('Reset all data')
            .setDesc('⚠️ Permanently delete all time tracking data')
            .addButton(button => button
                .setButtonText('Reset')
                .setWarning()
                .onClick(async () => {
                    await this.plugin.resetTimeData();
                    this.updateStatsDisplay(statsContainer);
                }));
    }

    private updateStatsDisplay(container: HTMLElement): void {
        container.empty();
        
        const allTimeTotal = this.plugin.calculateAllTimeTotal();
        const todayTotal = this.plugin.calculateTodayTotal();
        
        const allTimeFormatted = this.plugin.formatTime(allTimeTotal);
        const todayFormatted = this.plugin.formatTime(todayTotal);
        
        container.createEl('p', { text: `All time: ${allTimeFormatted}` });
        container.createEl('p', { text: `Today: ${todayFormatted}` });
        container.createEl('p', { text: `Total days tracked: ${this.plugin.timeData.length}` });
    }
}