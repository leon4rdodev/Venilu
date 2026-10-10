const path = require('path');

// Register tsconfig-paths to resolve path aliases.
// El tsconfig se lee con la API de TypeScript y no con `require('*.json')`:
// Node parsea los `.json` con JSON estricto, y revienta con los comentarios
// (`//` y `/* */`) que sí admite `tsc`.
const ts = require('typescript');
const tsConfigPath = path.join(__dirname, '../../tsconfig.electron.json');
const { config: tsConfig, error: tsConfigError } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
if (tsConfigError) {
    throw new Error(
        `No se pudo leer ${tsConfigPath}: ` +
        ts.flattenDiagnosticMessageText(tsConfigError.messageText, '\n')
    );
}

const tsConfigPaths = require('tsconfig-paths');
tsConfigPaths.register({
    baseUrl: tsConfig.compilerOptions.baseUrl,
    paths: tsConfig.compilerOptions.paths
});

// Register ts-node to compile TypeScript on the fly
require('ts-node').register({
    project: tsConfigPath,
    transpileOnly: true
});

// Import the actual main entry point
require('./main.ts');
