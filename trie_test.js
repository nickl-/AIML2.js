var TrieNode = require('./TrieNode');
var Path = require('./Path');
var AIMLProcessor = require('./AIMLProcessor');
var Bot = require('./Bot');

var bot = new Bot({name: 'Alice', age: 42});
bot.setMap = new Map();
tmpSet = ["FISH", "MATTER", "SLEEP", "LOVE"];
tmpSet.maxLength = 1;
bot.setMap.set("be", tmpSet);
bot.preProcessor = {};
bot.preProcessor.normalize = function(word) { return word; }

var root = new TrieNode();

var p = Path.sentenceToPath('MY DOG HAS FLEAS');
root.addPath(p);
p = Path.sentenceToPath('MY DOG HAS GREEN FUR');
root.addPath(p);
p = Path.sentenceToPath('THE QUICK BROWN FOX');

root = new TrieNode(bot);

console.log(root.findNode(Path.sentenceToPath('MY DOG HAS FLEAS')));

var categories = AIMLProcessor.AIMLToCategories('./personality.aiml');

console.log("Loaded ", categories.length, " categories.");
for (var c of categories)
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

matchedNode = root.match("WHY WILL NOT YOU BONK AND JIVE", "*", "*");
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

matchedNode = root.match("WOULD YOU RATHER FISH SALMON OR TROUT", "*", "*");
if (matchedNode)
{
  console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}
