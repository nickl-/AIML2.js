var TrieNode = require('./TrieNode');
var Path = require('./Path');
var AIMLProcessor = require('./AIMLProcessor');
var Bot = require('./Bot');

var bot = new Bot('alice2', './');
// bot.setMap = new Map();
tmpSet = ["FISH", "MATTER", "SLEEP", "LOVE"];
tmpSet.maxLength = 1;
bot.sets.set("be", tmpSet);

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

askAlice("Would you rather fish for salmon or sleep in?");

askAlice("Alice 2.0, Name something you find at a beach");

askAlice("what is the capital of arkansas?");

askAlice("what is the capital of Canada?");

} else {
  setTimeout(runTest, 1000);
}
}, 1000);


const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  bot.respond(line, console.log);
});
