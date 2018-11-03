const concurrently = require('concurrently');
const process = require('process');

if (process.platform !== 'win32') {
  process.stdout.write('\x1b]2; devNews \x1b\x5c');
}

// Files watch
const fsext = [
  // 'ts',
  'js',
  //'json',
  'yml',
  'env'
];

concurrently([{
    command: 'node_modules/.bin/tsc -p ./ --watch',
    name: 'Typescript',
    prefixColor: ['white', 'bgBlue', 'bold']
  },
  {
    command: `node_modules/.bin/nodemon --ext ${fsext.join(',')} ./out/index`,
    name: 'Bot',
    prefixColor: ['white', 'bgCyan', 'bold']
  }
], {
  prefix: 'name',
  killOthers: ['failure', 'success'],
  restartTries: 3
});
