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

setTimeout( function runTest() {
  console.log("Called runTest()");
  if (bot.isAIMLFileLoadingFinished) {

function askAlice(req) {
  console.log(">> "+ req);
  bot.respond(req, console.log);
}

askAlice("You are lazy.");

askAlice("Why will not you bonk and jive?");

askAlice("What is cheez whiz made from?");

askAlice("Would you rather fish salmon or trout?");

} else {
  setTimeout(runTest, 1000);
}
}, 1000);
