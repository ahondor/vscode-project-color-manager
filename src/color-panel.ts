import * as vscode from 'vscode';

interface ColorItem {
    name: string;
    color: string;
}

export class ColorPanel {
    public static currentPanel: ColorPanel | undefined;
    public static readonly viewType = 'projectColorManager.colorPanel';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;

    public static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ColorPanel.currentPanel) {
            ColorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ColorPanel.viewType,
            '🎨 Project Colors',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        ColorPanel.currentPanel = new ColorPanel(panel, context);
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'selectColor':
                        await this.applyColor(message.color);
                        break;
                    case 'addColor':
                        await this.addNewColor(message.name, message.color);
                        break;
                    case 'deleteColor':
                        await this.deleteColor(message.color);
                        break;
                    case 'deleteRecentColor':
                        await this.deleteRecentColor(message.color);
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
                    case 'copyColor':
                        await vscode.env.clipboard.writeText(message.color);
                        vscode.window.showInformationMessage(`Color ${message.color} copied!`);
                        break;
                    case 'editColor':
                        await this.editColor(message.originalColor, message.newColor);
                        break;
                    case 'editRecentColor':
                        await this.editRecentColor(message.originalColor, message.newColor);
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Оновлюємо панель при зміні конфігурації
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('projectColorManager')) {
                this._update();
            }
        });
    }

    private async applyColor(colorItem: ColorItem) {
        await vscode.commands.executeCommand('projectColorManager.setProjectColorDirectly', colorItem);
        this._update();
    }

    private async addNewColor(name: string, color: string) {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        
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
        this._update();
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
            this._update();
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
            this._update();
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
            this._update();
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
            this._update();
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
            this._update();
        }
    }

    private async resetToDefault() {
        try {
            await vscode.commands.executeCommand('projectColorManager.resetToDefault');
            this._update();
        } catch (error) {
            console.error('Color Panel: помилка resetToDefault:', error);
            vscode.window.showErrorMessage(`Помилка скидання кольору: ${error}`);
        }
    }

    public dispose() {
        ColorPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        const config = vscode.workspace.getConfiguration('projectColorManager');
        const predefinedColors: ColorItem[] = config.get('predefinedColors', []);
        const recentColors: ColorItem[] = config.get('recentColors', []);
        
        const currentColor = this.getCurrentColor();
        const currentColorName = this.getCurrentColorName();

        // Group colors by brightness as in the example
        const darkColors = predefinedColors.filter(c => this.isDarkColor(c.color));
        const mediumColors = predefinedColors.filter(c => this.isMediumColor(c.color));
        const brightColors = predefinedColors.filter(c => this.isBrightColor(c.color));

        return `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 Project Colors</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            text-align: center;
            color: var(--vscode-titleBar-activeForeground);
            margin-bottom: 30px;
            font-size: 2.2em;
        }

        .current-color-section {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            text-align: center;
        }

        .current-color-preview {
            width: 100px;
            height: 60px;
            border-radius: 8px;
            margin: 0 auto 15px;
            border: 2px solid var(--vscode-panel-border);
        }

        .add-color-section {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: 2fr 1fr auto;
            gap: 12px;
            align-items: end;
        }

        .form-input {
            padding: 8px 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-size: 14px;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .color-input {
            height: 40px;
            padding: 4px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
        }

        .btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
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

        .brightness-section {
            margin-bottom: 40px;
            background: var(--vscode-panel-background);
            border-radius: 12px;
            padding: 25px;
            border-left: 4px solid var(--vscode-focusBorder);
        }

        .section-title {
            font-size: 1.4em;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--vscode-titleBar-activeForeground);
        }

        .colors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }

        .color-card {
            background: var(--vscode-list-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 12px;
            transition: all 0.2s ease;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .color-card:hover {
            transform: translateY(-2px);
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .color-card.current {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
        }

        .color-preview {
            width: 100%;
            height: 50px;
            border-radius: 6px;
            margin-bottom: 10px;
            border: 1px solid var(--vscode-panel-border);
            position: relative;
        }

        .color-info {
            text-align: center;
        }

        .color-name {
            font-size: 0.95em;
            font-weight: 600;
            margin-bottom: 4px;
            line-height: 1.2;
        }

        .color-hex {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            color: var(--vscode-textLink-foreground);
            background: var(--vscode-input-background);
            padding: 3px 6px;
            border-radius: 3px;
            margin-bottom: 6px;
            display: inline-block;
            cursor: pointer;
            transition: background 0.2s ease;
        }

        .color-hex:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .delete-btn {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(240, 71, 71, 0.9);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
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
            top: 6px;
            right: 30px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(71, 140, 240, 0.9);
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
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
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
            gap: 8px;
            margin-top: 8px;
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
            padding: 4px 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        .edit-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .edit-color-input {
            width: 60px;
            height: 30px;
            padding: 2px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background: var(--vscode-input-background);
        }

        .edit-actions {
            display: flex;
            gap: 6px;
            justify-content: center;
        }

        .edit-btn-small {
            padding: 4px 8px;
            font-size: 11px;
            border: none;
            border-radius: 3px;
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
            padding: 6px 12px;
            margin-top: auto;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
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

        .actions {
            text-align: center;
            margin-top: 30px;
        }

        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 40px;
        }

        .copy-message {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 10px 20px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1000;
        }

        .copy-message.show {
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="container">
            <h1>🎨 Project Colors</h1>
    
    <div class="current-color-section">
        <h3>Current Color</h3>
            <div class="current-color-preview" style="background: ${currentColor || 'transparent'};"></div>
            <div><strong>${currentColorName}</strong></div>
            ${currentColor ? `<div class="color-hex" onclick="copyColor('${currentColor}')">${currentColor}</div>` : ''}
        </div>

        <div class="add-color-section">
            <h3>Add New Color</h3>
            <div class="form-grid">
                <input type="text" class="form-input" id="colorName" placeholder="Color name (e.g.: My Blue)" />
                <input type="color" class="color-input" id="colorValue" value="#007ACC" />
                <button class="btn" onclick="addColor()">Add</button>
            </div>
        </div>

        ${recentColors.length > 0 ? `
        <div class="brightness-section">
            <h2 class="section-title">
                <span>🕒</span>
                Recent Colors
            </h2>
            <div class="colors-grid">
                ${recentColors.slice(0, 8).map(color => `
                    <div class="color-card ${currentColor === color.color ? 'current' : ''}" id="recent-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}">
                        <button class="edit-btn" onclick="editRecentColor('${color.name}', '${color.color}')" title="Edit">✏️</button>
                        <button class="delete-btn" onclick="deleteRecentColor('${color.name}', '${color.color}')" title="Delete">×</button>
                        <div class="color-preview" style="background: ${color.color};"></div>
                        <div class="color-info">
                            <div class="color-name">${color.name}</div>
                            <div class="color-hex" onclick="copyColor('${color.color}')">${color.color}</div>
                        </div>
                        <button class="apply-btn" onclick="selectColor('${color.name}', '${color.color}')">Apply Color</button>
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

        ${predefinedColors.length > 0 ? `
        <div class="brightness-section">
            <h2 class="section-title">
                <span>🎨</span>
                All Colors
            </h2>
            <div class="colors-grid">
                ${predefinedColors.map(color => `
                    <div class="color-card ${currentColor === color.color ? 'current' : ''}" id="predefined-${color.name.replace(/\s+/g, '-')}-${color.color.replace('#', '')}">
                        <button class="edit-btn" onclick="editColor('${color.name}', '${color.color}')" title="Edit">✏️</button>
                        <button class="delete-btn" onclick="deleteColor('${color.name}', '${color.color}')" title="Delete">×</button>
                        <div class="color-preview" style="background: ${color.color};"></div>
                        <div class="color-info">
                            <div class="color-name">${color.name}</div>
                            <div class="color-hex" onclick="copyColor('${color.color}')">${color.color}</div>
                        </div>
                        <button class="apply-btn" onclick="selectColor('${color.name}', '${color.color}')">Apply Color</button>
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
        </div>
        ` : `
        <div class="empty-state">
            <h3>🎨 Start Adding Colors!</h3>
            <p>Use the form above to add the first color for your project.</p>
        </div>
        `}

        <div class="actions">
            <button class="btn btn-secondary" onclick="resetColor()">Reset to Default</button>
        </div>
    </div>

    <div class="copy-message" id="copyMessage">
        Color copied! 📋
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
                vscode.postMessage({
                    type: 'showError',
                    message: 'Please enter a color name'
                });
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

        function copyColor(color) {
            vscode.postMessage({
                type: 'copyColor',
                color: color
            });
            
            const message = document.getElementById('copyMessage');
            message.classList.add('show');
            setTimeout(() => {
                message.classList.remove('show');
            }, 2000);
        }

        // Add color on Enter
        document.getElementById('colorName').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addColor();
            }
        });

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

        // Hover ефекти
        document.querySelectorAll('.color-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-3px)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
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

    private isDarkColor(color: string): boolean {
        // Simple algorithm to determine dark colors
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 100;
    }

    private isMediumColor(color: string): boolean {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 100 && brightness < 180;
    }

    private isBrightColor(color: string): boolean {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 180;
    }
} 