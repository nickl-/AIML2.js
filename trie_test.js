var TrieNode = require('./TrieNode');
var Path = require('./Path');
var AIMLProcessor = require('./AIMLProcessor');
var bot = require('./Bot');

var root = new TrieNode();

var p = Path.sentenceToPath('MY DOG HAS FLEAS');
root.addPath(p);
p = Path.sentenceToPath('MY DOG HAS GREEN FUR');
root.addPath(p);
p = Path.sentenceToPath('THE QUICK BROWN FOX');

root = new TrieNode();

console.log(root.findNode(Path.sentenceToPath('MY DOG HAS FLEAS')));

var brain = new AIMLProcessor();
brain.AIMLToCategories('./personality.aiml');

console.log("Loaded ", brain.categories.length, " categories.");
for (var c of brain.categories)
{
  p = Path.sentenceToPath(c.pattern + " <THAT> " + c.that + " <TOPIC> " + c.topic);
  root.addPath(p, c);
}

var matchedNode = root.match("YOU ARE LAZY", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}

matchedNode = root.match("WHY WILL NOT YOU BONK", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}

var matchedNode = root.match("WHAT IS CHEEZE WHIZ MADE FROM", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}
