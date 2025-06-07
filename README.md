# Project Color Manager

VS Code extension for quickly customizing the title bar color of your project.

## Features

- **Status bar indicator**: Shows current project color in the status bar
- **Quick access**: Click on status bar to open color picker
- **Visual interface**: Beautiful web interface for viewing and managing colors
- **Editor commands**: Access through Command Palette (Ctrl+Shift+P)
- **Predefined colors**: Set of ready-to-use colors for quick selection
- **Recent colors**: Automatic saving of recently used colors
- **Custom colors**: Ability to create custom colors with names
- **Color management**: Add, delete and edit colors through the interface
- **Copy colors**: Quick copying of hex codes to clipboard

## Usage

### Quick access through status bar
1. Find the color indicator in the right part of the status bar (paint bucket icon)
2. Click on it to open the color picker
3. Choose a color from the list or create a new one

### Visual interface
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type `Open Visual Color Interface`
3. Or find the "Project Colors" panel in Explorer

### Editor commands
Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type:
- `Set Project Color` - opens color picker (quick selection)
- `Open Project Color Picker` - same as previous command
- `Open Visual Color Interface` - opens full visual interface

### Creating custom color
1. In the color picker select "Create new color"
2. Enter color name (e.g., "My favorite blue")
3. Enter hex color code (e.g., "#007ACC")
4. Color will be applied and added to recent list

## Configuration

The extension automatically creates a `.vscode/settings.json` file in your project with the following structure:

```json
{
    "workbench.colorCustomizations": {
        "titleBar.activeBackground": "#007ACC"
    }
}
```

### Extension configuration

You can configure predefined colors through VS Code settings:

```json
{
    "projectColorManager.predefinedColors": [
        {
            "name": "Blue",
            "color": "#007ACC"
        },
        {
            "name": "Green", 
            "color": "#16825D"
        }
    ]
}
```

## Development Setup

1. Clone the repository
```bash
git clone <repository-url>
cd vscode-project-color-manager
```

2. Install dependencies
```bash
npm install
```

3. Compile TypeScript
```bash
npm run compile
```

4. Run the extension
   - Press `F5` or go to `Run and Debug`
   - Select `Launch Extension`
   - A new VS Code window will open with the extension active

## Project Structure

```
├── src/
│   └── extension.ts    # Main extension code
├── out/                # Compiled JS files
├── package.json        # Extension manifest
├── tsconfig.json       # TypeScript configuration
└── README.md          # Documentation
```

## Author

**Andrii Yova**
- GitHub: [@ahondor](https://github.com/ahondor)
- Email: wotshef@gmail.com

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you like this extension, please:
- ⭐ Star the repository on GitHub
- 🐛 Report bugs or request features via [Issues](https://github.com/ahondor/vscode-project-color-manager/issues)
- 💬 Share your feedback

## License

MIT License

Copyright (c) 2024 Andrii Yova

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 