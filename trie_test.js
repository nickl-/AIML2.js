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

console.log(bot.respond("YOU ARE LAZY", "*", "*"));

console.log(bot.respond("WHY WILL NOT YOU BONK AND JIVE", "*", "*"));

console.log(bot.respond("What is cheez whiz made from?", "*", "*"));

console.log(bot.respond("WOULD YOU RATHER FISH SALMON OR TROUT", "*", "*"));
