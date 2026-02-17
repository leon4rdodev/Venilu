const path = require('path');

// Register tsconfig-paths to resolve path aliases
const tsConfig = require('../../tsconfig.electron.json');
const tsConfigPaths = require('tsconfig-paths');
tsConfigPaths.register({
    baseUrl: tsConfig.compilerOptions.baseUrl,
    paths: tsConfig.compilerOptions.paths
});

// Register ts-node to compile TypeScript on the fly
require('ts-node').register({
    project: path.join(__dirname, '../../tsconfig.electron.json'),
    transpileOnly: true
});

// Import the actual main entry point
require('./main.ts');
