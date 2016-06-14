var TrieNode = require('./TrieNode');
var Path = require('./Path');
var AIMLProcessor = require('./AIMLProcessor');
var Bot = require('./Bot');

var bot = new Bot({name: 'Alice', age: 42});
bot.setMap = new Map();
tmpSet = ["FISH", "MATTER", "SLEEP", "LOVE"];
tmpSet.maxLength = 1;
bot.setMap.set("be", tmpSet);

bot.loadAIMLFiles();

var matchedNode = bot.respond("YOU ARE LAZY", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}

matchedNode = bot.respond("WHY WILL NOT YOU BONK AND JIVE", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}

var matchedNode = bot.respond("What is cheez whiz made from?", "*", "*");
//var matchedNode = root.findNode(Path.sentenceToPath("YOU ARE LAZY <THAT> * <TOPIC> *"));
if (matchedNode)
{
console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}

matchedNode = bot.respond("WOULD YOU RATHER FISH SALMON OR TROUT", "*", "*");
if (matchedNode)
{
  console.log(matchedNode.category.template);
}
else
{
  console.log("Did not find match");
}
