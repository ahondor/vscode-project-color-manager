import * as vscode from 'vscode';

interface ColorItem {
    name: string;
    color: string;
}

export class ColorWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'projectColorManager.colorView';

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from webview
        webviewView.webview.onDidReceiveMessage(
            async (data) => {
                switch (data.type) {
                    case 'selectColor':
                        await this.applyColor(data.color);
                        break;
                    case 'addColor':
                        await this.addNewColor(data.name, data.color);
                        break;
                    case 'deleteColor':
                        await this.deleteColor(data.color);
                        break;
                    case 'deleteRecentColor':
                        await this.deleteRecentColor(data.color);
                        break;
                    case 'clearRecentColors':
                        await this.clearRecentColors();
                        break;
                    case 'resetColor':
                        const confirmed = await vscode.window.showWarningMessage(
                            'Reset project color to default?',
                            { modal: true },
                            'Yes'
                        );
                        if (confirmed === 'Yes') {
                            await this.resetToDefault();
                        }
                        break;
                    case 'refreshColors':
                        this.refreshWebview();
                        break;
                    case 'editColor':
                        await this.editColor(data.originalColor, data.newColor);
                        break;
                    case 'editRecentColor':
                        await this.editRecentColor(data.originalColor, data.newColor);
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(data.message);
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );

        // Update interface when configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('projectColorManager')) {
                this.refreshWebview();
            }
        });

        this.refreshWebview();
    }

    private async applyColor(colorItem: ColorItem) {
        // Call command to set color
        await vscode.commands.executeCommand('projectColorManager.setProjectColorDirectly', colorItem);
        this.refreshWebview();
    }

    private async addNewColor(name: string, color: string) {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        
        // Check for duplicates
        const exists = predefinedColors.some(item => 
            item.color.toLowerCase() === color.toLowerCase() || item.name === name
        );
        
        if (exists) {
            vscode.window.showWarningMessage('Color with this name or code already exists');
            return;
        }

        predefinedColors.push({ name, color });
        await config.update('predefinedColors', predefinedColors, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Added new color: "${name}"`);
        this.refreshWebview();
    }

    private async deleteColor(colorToDelete: ColorItem) {
        const confirmed = await vscode.window.showWarningMessage(
            `Delete color "${colorToDelete.name}"?`,
            { modal: true },
            'Yes, delete'
        );

        if (confirmed === 'Yes, delete') {
            const config = vscode.workspace.getConfiguration('projectColorManager');
            const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
            
            const filteredColors = predefinedColors.filter(item => 
                item.color !== colorToDelete.color || item.name !== colorToDelete.name
            );
            
            await config.update('predefinedColors', filteredColors, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Deleted color: "${colorToDelete.name}"`);
            this.refreshWebview();
        }
    }

    private async deleteRecentColor(colorToDelete: ColorItem) {
        const confirmed = await vscode.window.showWarningMessage(
            `Delete saved color "${colorToDelete.name}"?`,
            { modal: true },
            'Yes, delete'
        );

        if (confirmed === 'Yes, delete') {
            const config = vscode.workspace.getConfiguration('projectColorManager');
            const recentColors: ColorItem[] = config.get('recentColors', []);
            
            const filteredColors = recentColors.filter(item => 
                item.color !== colorToDelete.color || item.name !== colorToDelete.name
            );
            
            await config.update('recentColors', filteredColors, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Deleted saved color: "${colorToDelete.name}"`);
            this.refreshWebview();
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
            vscode.window.showInformationMessage('Saved colors cleared');
            this.refreshWebview();
        }
    }

    private async editColor(originalColor: ColorItem, newColor: ColorItem) {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        
        const colorIndex = predefinedColors.findIndex(item => 
            item.color === originalColor.color && item.name === originalColor.name
        );
        
        if (colorIndex !== -1) {
            predefinedColors[colorIndex] = newColor;
            await config.update('predefinedColors', predefinedColors, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Color updated: "${originalColor.name}" → "${newColor.name}"`);
            this.refreshWebview();
        }
    }

    private async editRecentColor(originalColor: ColorItem, newColor: ColorItem) {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const recentColors: ColorItem[] = config.get('recentColors', []);
        
        const colorIndex = recentColors.findIndex(item => 
            item.color === originalColor.color && item.name === originalColor.name
        );
        
        if (colorIndex !== -1) {
            recentColors[colorIndex] = newColor;
            await config.update('recentColors', recentColors, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Saved color updated: "${originalColor.name}" → "${newColor.name}"`);
            this.refreshWebview();
        }
    }

    private async resetToDefault() {
        // Call command to reset color
        await vscode.commands.executeCommand('projectColorManager.resetToDefault');
        this.refreshWebview();
    }

    private refreshWebview() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        const recentColors: ColorItem[] = config.get('recentColors', []);
        
        // Get current color
        const currentColor = this.getCurrentColor();
        
        return `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Color Manager</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
            line-height: 1.4;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .current-color {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
            padding: 12px;
            background: var(--vscode-panel-background);
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
        }

        .current-color-preview {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }

        .section {
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-titleBar-activeForeground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .colors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 12px;
        }

        .color-card {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 8px;
            text-align: center;
            transition: all 0.2s ease;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .color-card:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        .color-card.current {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
        }

        .color-preview {
            width: 100%;
            height: 35px;
            border-radius: 4px;
            margin: 0 0 6px 0;
            border: 1px solid var(--vscode-panel-border);
            position: relative;
        }

        .color-name {
            font-size: 10px;
            font-weight: 500;
            margin-bottom: 2px;
            line-height: 1.2;
        }

        .color-hex {
            font-size: 9px;
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textLink-foreground);
        }

        .delete-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(240, 71, 71, 0.9);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10;
            line-height: 1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .delete-btn:hover {
            background: rgba(240, 71, 71, 1);
            transform: scale(1.1);
        }

        .color-card:hover .delete-btn,
        .color-card:hover .edit-btn {
            display: flex;
        }

        .edit-btn {
            position: absolute;
            top: 2px;
            right: 22px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(71, 140, 240, 0.9);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 9px;
            font-weight: bold;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10;
            line-height: 1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .edit-btn:hover {
            background: rgba(71, 140, 240, 1);
            transform: scale(1.1);
        }

        .color-card.editing {
            background: var(--vscode-input-background);
            border-color: var(--vscode-focusBorder);
        }

        .edit-form {
            display: none;
            flex-direction: column;
            gap: 6px;
            margin-top: 4px;
        }

        .color-card.editing .edit-form {
            display: flex;
        }

        .color-card.editing .color-name,
        .color-card.editing .color-hex,
        .color-card.editing .apply-btn {
            display: none;
        }

        .edit-input {
            padding: 3px 6px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            color: var(--vscode-input-foreground);
            font-size: 10px;
        }

        .edit-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .edit-color-input {
            width: 40px;
            height: 20px;
            padding: 0;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background: var(--vscode-input-background);
        }

        .edit-actions {
            display: flex;
            gap: 4px;
            justify-content: center;
        }

        .edit-btn-small {
            padding: 2px 6px;
            font-size: 9px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }

        .edit-save {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .edit-cancel {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .apply-btn {
            width: 100%;
            padding: 4px 8px;
            margin-top: auto;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            transition: all 0.2s ease;
        }

        .color-card:hover .apply-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-background);
        }

        .color-card:hover .apply-btn:hover {
            background: var(--vscode-button-hoverBackground);
            border-color: var(--vscode-button-hoverBackground);
        }

        .add-color-form {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .form-row {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }

        .form-input {
            flex: 1;
            padding: 6px 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .color-input {
            width: 60px;
            padding: 4px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background: var(--vscode-input-background);
        }

        .btn {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s ease;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .actions {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-top: 16px;
        }

        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>🎨 Project Colors</h3>
    </div>

    <div class="current-color">
        <div class="current-color-preview" style="background: ${currentColor || '#00000000'};"></div>
        <span>Current: ${this.getCurrentColorName()}</span>
    </div>

    <div class="add-color-form">
        <div class="form-row">
            <input type="text" class="form-input" id="colorName" placeholder="Color name" />
            <input type="color" class="color-input" id="colorValue" value="#007ACC" />
            <button class="btn" onclick="addColor()">Add</button>
        </div>
    </div>

    ${recentColors.length > 0 ? `
    <div class="section">
        <div class="section-title">🕒 Recent Colors</div>
        <div class="colors-grid">
            ${recentColors.map(color => `
                <div class="color-card ${currentColor === color.color ? 'current' : ''}" id="recent-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}">
                    <button class="edit-btn" onclick="editRecentColor('${color.name}', '${color.color}')" title="Edit">✏️</button>
                    <button class="delete-btn" onclick="deleteRecentColor('${color.name}', '${color.color}')" title="Delete">×</button>
                    <div class="color-preview" style="background: ${color.color};"></div>
                    <div class="color-name">${color.name}</div>
                    <div class="color-hex">${color.color}</div>
                    <button class="apply-btn" onclick="selectColor('${color.name}', '${color.color}')">Apply</button>
                    <div class="edit-form">
                        <input type="text" class="edit-input" value="${color.name}" placeholder="Color name">
                        <input type="color" class="edit-color-input" value="${color.color}">
                        <div class="edit-actions">
                            <button class="edit-btn-small edit-save" onclick="saveRecentColor('${color.name}', '${color.color}')">💾</button>
                            <button class="edit-btn-small edit-cancel" onclick="cancelEdit('recent-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}')">❌</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="actions">
            <button class="btn btn-secondary" onclick="clearRecentColors()">Clear All Saved</button>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">🎨 Predefined Colors</div>
        ${predefinedColors.length > 0 ? `
        <div class="colors-grid">
            ${predefinedColors.map(color => `
                <div class="color-card ${currentColor === color.color ? 'current' : ''}" id="predefined-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}">
                    <button class="edit-btn" onclick="editColor('${color.name}', '${color.color}')" title="Edit">✏️</button>
                    <button class="delete-btn" onclick="deleteColor('${color.name}', '${color.color}')" title="Delete">×</button>
                    <div class="color-preview" style="background: ${color.color};"></div>
                    <div class="color-name">${color.name}</div>
                    <div class="color-hex">${color.color}</div>
                    <button class="apply-btn" onclick="selectColor('${color.name}', '${color.color}')">Apply</button>
                    <div class="edit-form">
                        <input type="text" class="edit-input" value="${color.name}" placeholder="Color name">
                        <input type="color" class="edit-color-input" value="${color.color}">
                        <div class="edit-actions">
                            <button class="edit-btn-small edit-save" onclick="saveColor('${color.name}', '${color.color}')">💾</button>
                            <button class="edit-btn-small edit-cancel" onclick="cancelEdit('predefined-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}')">❌</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : `
        <div class="empty-state">
            No predefined colors.<br>
            Add the first color using the form above.
        </div>
        `}
    </div>

    <div class="actions">
        <button class="btn btn-secondary" onclick="resetColor()">Reset to Default</button>
        <button class="btn btn-secondary" onclick="refreshColors()">Refresh</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function selectColor(name, color) {
            vscode.postMessage({
                type: 'selectColor',
                color: { name, color }
            });
        }

        function addColor() {
            const nameInput = document.getElementById('colorName');
            const colorInput = document.getElementById('colorValue');
            
            const name = nameInput.value.trim();
            const color = colorInput.value;
            
            if (!name) {
                return;
            }

            vscode.postMessage({
                type: 'addColor',
                name: name,
                color: color
            });

            nameInput.value = '';
            colorInput.value = '#007ACC';
        }

        function deleteColor(name, color) {
            vscode.postMessage({
                type: 'deleteColor',
                color: { name, color }
            });
        }

        function deleteRecentColor(name, color) {
            vscode.postMessage({
                type: 'deleteRecentColor',
                color: { name, color }
            });
        }

        function clearRecentColors() {
            vscode.postMessage({
                type: 'clearRecentColors'
            });
        }

        function resetColor() {
            vscode.postMessage({
                type: 'resetColor'
            });
        }

        function refreshColors() {
            vscode.postMessage({
                type: 'refreshColors'
            });
        }

        function editColor(name, color) {
            const cardId = 'predefined-' + name.replace(/\\s+/g, '-') + '-' + color.replace('#', '');
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.add('editing');
            }
        }

        function editRecentColor(name, color) {
            const cardId = 'recent-' + name.replace(/\\s+/g, '-') + '-' + color.replace('#', '');
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.add('editing');
            }
        }

        function saveColor(originalName, originalColor) {
            const cardId = 'predefined-' + originalName.replace(/\\s+/g, '-') + '-' + originalColor.replace('#', '');
            const card = document.getElementById(cardId);
            if (card) {
                const nameInput = card.querySelector('.edit-input');
                const colorInput = card.querySelector('.edit-color-input');
                
                const newName = nameInput.value.trim();
                const newColor = colorInput.value;
                
                if (!newName) {
                    vscode.postMessage({
                        type: 'showError',
                        message: 'Please enter a color name'
                    });
                    return;
                }

                vscode.postMessage({
                    type: 'editColor',
                    originalColor: { name: originalName, color: originalColor },
                    newColor: { name: newName, color: newColor }
                });
            }
        }

        function saveRecentColor(originalName, originalColor) {
            const cardId = 'recent-' + originalName.replace(/\\s+/g, '-') + '-' + originalColor.replace('#', '');
            const card = document.getElementById(cardId);
            if (card) {
                const nameInput = card.querySelector('.edit-input');
                const colorInput = card.querySelector('.edit-color-input');
                
                const newName = nameInput.value.trim();
                const newColor = colorInput.value;
                
                if (!newName) {
                    vscode.postMessage({
                        type: 'showError',
                        message: 'Please enter a color name'
                    });
                    return;
                }

                vscode.postMessage({
                    type: 'editRecentColor',
                    originalColor: { name: originalName, color: originalColor },
                    newColor: { name: newName, color: newColor }
                });
            }
        }

        function cancelEdit(cardId) {
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.remove('editing');
            }
        }

        // Add color on Enter
        document.getElementById('colorName').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addColor();
            }
        });
    </script>
</body>
</html>`;
    }

    private getCurrentColor(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        const fs = require('fs');
        const path = require('path');
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

        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        const recentColors: ColorItem[] = config.get('recentColors', []);

        const allColors = [...predefinedColors, ...recentColors];
        const foundColor = allColors.find(item => item.color.toLowerCase() === currentColor.toLowerCase());
        
        return foundColor?.name || currentColor;
    }
} 