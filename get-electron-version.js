const fs = require('fs');
const path = require('path');

const vscodePath = process.env.VSCODE_CLI || '/usr/share/code'; // Adjust the path according to your VS Code installation

const packageJsonPath = path.join(vscodePath, 'resources', 'app', 'package.json');
fs.readFile(packageJsonPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Could not read package.json:', err);
        return;
    }
    const packageJson = JSON.parse(data);
    const electronVersion = packageJson.dependencies.electron || packageJson.devDependencies.electron;
    console.log('Electron version:', electronVersion);
});
