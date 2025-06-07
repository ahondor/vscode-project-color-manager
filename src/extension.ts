import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ColorItem {
    name: string;
    color: string;
}

export class ProjectColorManager {
    private statusBarItem: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'projectColorManager.openColorPicker';
        this.statusBarItem.show();
        this.updateStatusBar();
    }

    private getCurrentColor(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            return null;
        }

        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(settingsContent);
            return settings['workbench.colorCustomizations']?.['titleBar.activeBackground'] || null;
        } catch (error) {
            return null;
        }
    }

    private getCurrentColorName(): string {
        const currentColor = this.getCurrentColor();
        if (!currentColor) {
            return 'Default';
        }

        // Try to find color name among predefined colors
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        const recentColors: ColorItem[] = config.get('recentColors', []);

        const allColors = [...predefinedColors, ...recentColors];
        const foundColor = allColors.find(item => item.color.toLowerCase() === currentColor.toLowerCase());
        
        return foundColor?.name || currentColor;
    }

    private updateStatusBar() {
        const colorName = this.getCurrentColorName();
        this.statusBarItem.text = `$(paintcan) ${colorName}`;
        this.statusBarItem.tooltip = 'Click to change project color';
    }

    public async setProjectColor(colorItem: ColorItem) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No open workspace folder found');
            return;
        }

        try {
            // Use VS Code API to safely update workspace settings
            // This will only modify the specific setting we need
            const config = vscode.workspace.getConfiguration('workbench', workspaceFolder.uri);
            
            // Get current colorCustomizations or create empty object
            const colorCustomizations: any = config.get('colorCustomizations', {});
            
            // Update only the titleBar.activeBackground property
            const updatedColorCustomizations = {
                ...colorCustomizations,
                'titleBar.activeBackground': colorItem.color
            };
            
            // Update the setting in workspace scope (will create/update .vscode/settings.json)
            await config.update('colorCustomizations', updatedColorCustomizations, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(`Project color changed to "${colorItem.name}"`);
            
            // Add to recent colors
            await this.addToRecentColors(colorItem);
            this.updateStatusBar();
        } catch (error) {
            vscode.window.showErrorMessage('Error saving settings');
            console.error('Error updating workspace settings:', error);
        }
    }

    private async addToRecentColors(colorItem: ColorItem) {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const recentColors: ColorItem[] = config.get('recentColors', []);
        
        // Remove duplicates
        const filteredColors = recentColors.filter(item => 
            item.color.toLowerCase() !== colorItem.color.toLowerCase()
        );
        
        // Add new color to the beginning
        filteredColors.unshift(colorItem);
        
        // Limit the number of recent colors
        const limitedColors = filteredColors.slice(0, 10);
        
        await config.update('recentColors', limitedColors, vscode.ConfigurationTarget.Global);
    }

    public async openColorPicker() {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        const recentColors: ColorItem[] = config.get('recentColors', []);

        const items: vscode.QuickPickItem[] = [];

        // Add visual interface option
        items.push({
            label: '$(window) Open Visual Interface',
            description: 'Fullscreen interface with palette',
            detail: 'Go to visual interface with large color palette'
        });

        // Add create new color option
        items.push({
            label: '$(add) Create New Color',
            description: 'Add custom color',
            detail: 'Create new color with name and hex code'
        });

        // Add reset to default option
        items.push({
            label: '$(trash) Reset to Default',
            description: 'Remove color settings',
            detail: 'Return to default title bar color'
        });

        // Add recent colors
        if (recentColors.length > 0) {
            items.push({
                label: 'Recent Colors',
                kind: vscode.QuickPickItemKind.Separator
            });
            
            recentColors.forEach(item => {
                items.push({
                    label: `$(paintcan) ${item.name}`,
                    description: item.color,
                    detail: 'Recently used color'
                });
            });

            // Add clear recent colors option
            items.push({
                label: '$(close) Clear Recent Colors',
                description: 'Remove all saved colors',
                detail: 'Clear the list of recently used colors'
            });
        }

        // Add predefined colors
        items.push({
            label: 'Predefined Colors',
            kind: vscode.QuickPickItemKind.Separator
        });

        predefinedColors.forEach(item => {
            items.push({
                label: `$(paintcan) ${item.name}`,
                description: item.color,
                detail: 'Predefined color'
            });
        });

        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: 'Choose a color for your project'
        });

        if (!selectedItem) {
            return;
        }

        if (selectedItem.label === '$(window) Open Visual Interface') {
            await vscode.commands.executeCommand('projectColorManager.openVisualInterface');
        } else if (selectedItem.label === '$(add) Create New Color') {
            await this.createNewColor();
        } else if (selectedItem.label === '$(trash) Reset to Default') {
            await this.resetToDefault();
        } else if (selectedItem.label === '$(close) Clear Recent Colors') {
            await this.clearRecentColors();
        } else {
            // Find selected color
            const colorName = selectedItem.label.replace('$(paintcan) ', '');
            const allColors = [...recentColors, ...predefinedColors];
            const colorItem = allColors.find(item => item.name === colorName);
            
            if (colorItem) {
                await this.setProjectColor(colorItem);
            }
        }
    }

    private async createNewColor() {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter color name',
            placeHolder: 'e.g.: My Blue'
        });

        if (!name) {
            return;
        }

        const color = await vscode.window.showInputBox({
            prompt: 'Enter hex color code',
            placeHolder: 'e.g.: #007ACC',
            validateInput: (value: string) => {
                if (!value.match(/^#[0-9A-Fa-f]{6}$/)) {
                    return 'Enter a valid hex color code (e.g., #007ACC)';
                }
                return undefined;
            }
        });

        if (!color) {
            return;
        }

        const colorItem: ColorItem = { name, color };
        await this.setProjectColor(colorItem);
    }

    public async setColorCommand() {
        await this.openColorPicker();
    }

    public async resetToDefault() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No open workspace folder found');
            return;
        }

        try {
            // Use VS Code API to safely update workspace settings
            const config = vscode.workspace.getConfiguration('workbench', workspaceFolder.uri);
            
            // Get current colorCustomizations
            const colorCustomizations: any = config.get('colorCustomizations', {});
            
            // Check if titleBar.activeBackground exists
            if (!colorCustomizations['titleBar.activeBackground']) {
                vscode.window.showInformationMessage('Color is already set to default');
                this.updateStatusBar();
                return;
            }
            
            // Create a copy without titleBar.activeBackground
            const updatedColorCustomizations = { ...colorCustomizations };
            delete updatedColorCustomizations['titleBar.activeBackground'];
            
            // If colorCustomizations becomes empty, set to undefined to remove the property
            const finalValue = Object.keys(updatedColorCustomizations).length === 0 
                ? undefined 
                : updatedColorCustomizations;
            
            // Update the setting in workspace scope
            await config.update('colorCustomizations', finalValue, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage('Color reset to default');
            this.updateStatusBar();
        } catch (error) {
            vscode.window.showErrorMessage(`Error resetting settings: ${error}`);
            console.error('Error updating workspace settings:', error);
        }
    }

    private async clearRecentColors() {
        const confirmed = await vscode.window.showWarningMessage(
            'Clear all saved colors?',
            { modal: true },
            'Yes, clear'
        );

        if (confirmed === 'Yes, clear') {
            const config = vscode.workspace.getConfiguration('projectColorManager');
            await config.update('recentColors', [], vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Recent colors cleared');
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const projectColorManager = new ProjectColorManager(context);

    // Import WebView provider and panel
    const { ColorWebViewProvider } = require('./webview-provider');
    const { ColorPanel } = require('./color-panel');
    const webviewProvider = new ColorWebViewProvider(context);

    // Register WebView provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ColorWebViewProvider.viewType, webviewProvider)
    );

    // Register commands
    const setColorCommand = vscode.commands.registerCommand('projectColorManager.setColor', () => {
        projectColorManager.setColorCommand();
    });

    const openColorPickerCommand = vscode.commands.registerCommand('projectColorManager.openColorPicker', () => {
        projectColorManager.openColorPicker();
    });

    const openVisualInterfaceCommand = vscode.commands.registerCommand('projectColorManager.openVisualInterface', () => {
        ColorPanel.createOrShow(context);
    });

    const setProjectColorDirectlyCommand = vscode.commands.registerCommand('projectColorManager.setProjectColorDirectly', (colorItem: ColorItem) => {
        return projectColorManager.setProjectColor(colorItem);
    });

    const resetToDefaultCommand = vscode.commands.registerCommand('projectColorManager.resetToDefault', async () => {
        try {
            await projectColorManager.resetToDefault();
        } catch (error) {
            console.error('Extension: error in resetToDefault command:', error);
            vscode.window.showErrorMessage(`Error resetting color: ${error}`);
        }
    });

    context.subscriptions.push(setColorCommand);
    context.subscriptions.push(openColorPickerCommand);
    context.subscriptions.push(openVisualInterfaceCommand);
    context.subscriptions.push(setProjectColorDirectlyCommand);
    context.subscriptions.push(resetToDefaultCommand);
    context.subscriptions.push(projectColorManager);

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('projectColorManager')) {
            // Update status bar when configuration changes
            projectColorManager['updateStatusBar']();
        }
    });
}

export function deactivate() {} 