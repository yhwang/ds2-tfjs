const shell = require('shelljs');
const path = require('path');

// copy trie_pb.js to dist
shell.cp(
    path.join(__dirname, '..', 'src', 'lib', 'trie_pb.js'),
    path.join(__dirname, '..', 'dist', 'lib')
);

shell.cp(
    path.join(__dirname, '..', 'src', 'lib', 'trie_pb.d.ts'),
    path.join(__dirname, '..', 'dist', 'lib')
);
