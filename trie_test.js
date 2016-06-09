var TrieNode = require('./TrieNode');
var Path = require('./Path');

var root = new TrieNode();

var p = Path.sentenceToPath('MY DOG HAS FLEAS');
root.addPath(p);
p = Path.sentenceToPath('MY DOG HAS GREEN FUR');
root.addPath(p);
p = Path.sentenceToPath('THE QUICK BROWN FOX');

console.log(root.findNode(Path.sentenceToPath('MY DOG HAS FLEAS')));
